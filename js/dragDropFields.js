
// Custom DraggingTool for dragging fields instead of whole Parts.
// FieldDraggingTool.fieldTemplate needs to be set to a template of the field that you want shown while dragging.
function FieldDraggingTool() {
    go.DraggingTool.call(this);
    this.fieldTemplate = null;  // THIS NEEDS TO BE SET before a drag starts
    this.temporaryPart = null;
  }
  go.Diagram.inherit(FieldDraggingTool, go.DraggingTool);

  // override this method
  FieldDraggingTool.prototype.findDraggablePart = function() {
    var diagram = this.diagram;
    var obj = diagram.findObjectAt(diagram.lastInput.documentPoint);
    while (obj !== null && obj.type !== go.Panel.TableRow) obj = obj.panel;
    if (obj !== null && obj.type === go.Panel.TableRow &&
      this.fieldTemplate !== null && this.temporaryPart === null) {
      var tempPart =
        go.GraphObject.make(go.Node, "Table",
          { layerName: "Tool", locationSpot: go.Spot.Center },
          this.fieldTemplate.copy());  // copy the template!
      this.temporaryPart = tempPart;
      // assume OBJ is now a Panel representing a field, bound to field data
      // update the temporary Part via data binding
      tempPart.location = diagram.lastInput.documentPoint;  // need to set location explicitly
      diagram.add(tempPart);  // add to Diagram before setting data
      tempPart.data = obj.data;  // bind to the same field data as being dragged
      return tempPart;
    }
    return go.DraggingTool.prototype.findDraggablePart.call(this);
  };

  FieldDraggingTool.prototype.doActivate = function() {
    if (this.temporaryPart === null) return go.DraggingTool.prototype.doActivate.call(this);
    var diagram = this.diagram;
    this.standardMouseSelect();
    this.isActive = true;
    // instead of the usual result of computeEffectiveCollection, just use the temporaryPart alone
    var map = new go.Map(/*go.Part, go.DraggingInfo*/);
    map.set(this.temporaryPart, new go.DraggingInfo(diagram.lastInput.documentPoint.copy()));
    this.draggedParts = map;
    this.startTransaction("Drag Field");
    diagram.isMouseCaptured = true;
  };

  FieldDraggingTool.prototype.doDeactivate = function() {
    if (this.temporaryPart === null) return go.DraggingTool.prototype.doDeactivate.call(this);
    var diagram = this.diagram;
    // make sure the temporary Part is no longer in the Diagram
    diagram.remove(this.temporaryPart);
    this.temporaryPart = null;
    // now do all the standard deactivation cleanup,
    // including setting isActive = false, clearing out draggedParts, calling stopTransaction(),
    // and setting diagram.isMouseCaptured = false
    go.DraggingTool.prototype.doDeactivate.call(this);
  };

  FieldDraggingTool.prototype.doMouseMove = function() {
    if (!this.isActive) return;
    if (this.temporaryPart === null) return go.DraggingTool.prototype.doMouseMove.call(this);
    var diagram = this.diagram;
    // just move the temporaryPart (in draggedParts), without regard to moving or copying permissions of the Node
    var offset = diagram.lastInput.documentPoint.copy().subtract(diagram.firstInput.documentPoint);
    this.moveParts(this.draggedParts, offset, false);
  };

  FieldDraggingTool.prototype.doMouseUp = function() {
    if (!this.isActive) return;
    if (this.temporaryPart === null) return go.DraggingTool.prototype.doMouseUp.call(this);
    var diagram = this.diagram;
    var data = this.temporaryPart.data;
    var dest = diagram.findPartAt(diagram.lastInput.documentPoint, false);
    if (dest !== null && dest.data && dest.data.fields) {
      var panel = dest.findObject("TABLE");
      var idx = panel.findRowForLocalY(panel.getLocalPoint(diagram.lastInput.documentPoint).y);
      diagram.model.insertArrayItem(dest.data.fields, idx + 1,
        { name: data.name, info: data.info, color: data.color, figure: data.figure });
    }
    var src = this.currentPart;
    // whether or not there was a destination node, delete the original field
    if (!(diagram.lastInput.control || diagram.lastInput.meta)) {
      var sidx = src.data.fields.indexOf(data);
      if (sidx >= 0) {
        diagram.model.removeArrayItem(src.data.fields, sidx);
      }
    }
    this.transactionResult = "Inserted Field";
    this.stopTool();
  };
  // end of FieldDraggingTool


  function init() {
    var $ = go.GraphObject.make;  // for conciseness in defining templates

    myDiagram =
      $(go.Diagram, "myDiagramDiv",
        {
          validCycle: go.Diagram.CycleNotDirected,  // don't allow loops
          draggingTool: $(FieldDraggingTool),  // use custom DraggingTool
          // automatically update the model that is shown on this page
          "ModelChanged": function(e) { if (e.isTransactionFinished) showModel(); },
          "undoManager.isEnabled": true
        });

    // This template is a Panel that is used to represent each item in a Panel.itemArray.
    // The Panel is data bound to the item object.
    // This template needs to be used by the FieldDraggingTool as well as the Diagram.nodeTemplate.
    var fieldTemplate =
      $(go.Panel, "TableRow",  // this Panel is a row in the containing Table
        new go.Binding("portId", "name"),  // this Panel is a "port"
        {
          background: "transparent",  // so this port's background can be picked by the mouse
          fromSpot: go.Spot.Right,  // links only go from the right side to the left side
          toSpot: go.Spot.Left
        },  // allow drawing links from or to this port
        $(go.Shape,
          { width: 12, height: 12, column: 0, strokeWidth: 2, margin: 4 },
          new go.Binding("figure", "figure"),
          new go.Binding("fill", "color")),
        $(go.TextBlock,
          { margin: new go.Margin(0, 20), column: 1, font: "bold 13px sans-serif" },
          new go.Binding("text", "name")),
        $(go.TextBlock,
          { margin: new go.Margin(0, 20), column: 2, font: "13px sans-serif" },
          new go.Binding("text", "info"))
      );

    // the FieldDraggingTool needs a template for what to show while dragging
    myDiagram.toolManager.draggingTool.fieldTemplate = fieldTemplate;

    // This template represents a whole "record".
    myDiagram.nodeTemplate =
      $(go.Node, "Auto",
        {
          movable: false,
          copyable: false,
          deletable: false,
          locationSpot: go.Spot.Center
        },
        new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
        // this rectangular shape surrounds the content of the node
        $(go.Shape,
          { fill: "#A4A9B2" }),
        // the content consists of a header and a list of items
        $(go.Panel, "Vertical",
          // this is the header for the whole node
          $(go.Panel, "Auto",
            { stretch: go.GraphObject.Horizontal },  // as wide as the whole node
            $(go.Shape,
              { fill: "#6e3f94", stroke: null }),
              $(go.Shape, 
                {
                    click: nodeClicked,
                    width: 14,
                    height: 14,
                    stroke: null,
                    fill: "#797979",
                    alignment: go.Spot.Right,
                    margin: 2,
              },
              new go.Binding("click", "click"),
              new go.Binding("visible", "lilplusvis")),
              $(go.Shape, 
                {
                    click: nodeClicked,
                    width: 8, 
                    height: 8, 
                    figure: "PlusLine",
                    alignment: go.Spot.Right,
                    margin: 4,
                },
                new go.Binding("click", "click"),
                new go.Binding("visible", "lilplusvis")),
              $(go.TextBlock,
                {
                  alignment: go.Spot.Center,
                  margin: 3,
                  stroke: "#FFFFFF",
                  textAlign: "center",
                  font: "bold 12pt sans-serif"
                },
                new go.Binding("text", "title"))),
              

          // this Panel holds a Panel for each item object in the itemArray;
          // each item Panel is defined by the itemTemplate to be a TableRow in this Table
          $(go.Panel, "Table",
            {
              name: "TABLE",
              padding: 2,
              minSize: new go.Size(100, 10),
              defaultStretch: go.GraphObject.Horizontal,
              itemTemplate: fieldTemplate
            },
            new go.Binding("itemArray", "fields")
          )  // end Table Panel of items
        )  // end Vertical Panel
      );  // end Node

    myDiagram.model =
      $(go.GraphLinksModel,
        {
          linkFromPortIdProperty: "fromPort",
          linkToPortIdProperty: "toPort",
          copiesArrays: true,
          copiesArrayObjects: true,
          nodeDataArray: [
            {
              key: 1,
              title: "Citizens of Interest",
              fields: [
                { name: "18", info: "No longer available", color: "#506787", figure: "Ellipse" },
                { name: "50", info: "Low compassion score", color: "#5a559e", figure: "Ellipse" },
                { name: "79", info: "At least they have GSoH", color: "#6e3f94", figure: "Diamond" }
              ],
              loc: "0 0",
              lilplusvis: true,
            },
            {
              key: 2,
              title: "Vectis Agents",
              fields: [
                { name: "Mercury", info: "MIA 1991", color: "#5a559e", figure: "Diamond" },
                { name: "Rutherfordium", info: "Stamp Collecting", color: "#506787", figure: "Diamond" },
              ],
              loc: "400 0",
              lilplusvis: false,
            }
          ]
        });

    showModel();  // show the diagram's initial model

    function showModel() {
      document.getElementById("mySavedModel").value = myDiagram.model.toJson();
      
      var event = new Event("input", {
          bubbles: true,
          cancelable: true,
      });

      document.getElementById("mySavedModel").dispatchEvent(event);

    }

    var timesClicked = 0;
    descriptions = new Array(20); //Arbitrarily limits you to 20 new citizens of interest.
    descriptions = [
        "liquid metal, toxic",
        "soft metal, toxic",
        "dense, soft, non-corroding metal, toxic",
        "low melting point, brittle metal",
        "radioactive, long-lived",
        "radioactive, short-lived",
        "radioactive gas, short-lived",
        "radioactive, short-lived, larger than cesium",
        "radioactive, long-lived",
        "radioactive, long-lived",
        "god of thunder, seems overqualified",
        "radioactive, long-lived",
        "radioactive, long-lived, dense",
        "radioactive, long-lived",
        "radioactive, long-lived",
        "radioactive, long-lived",
        "radioactive, long-lived",
        "radioactive, long-lived",
        "radioactive, long-lived",
        " radioactive, short-lived",
    ];

    function nodeClicked(e, obj) {
        var interesting_citizens = myDiagram.model.nodeDataArray[0];
        var vectis_agents = myDiagram.model.nodeDataArray[1];
        interesting_citizens.fields.push({
            name: `${79 + 1 + timesClicked}`, info: `${descriptions[timesClicked]}`, color: "#5a559e", figure: "ellipse",
        });
        // I use their remove Node data then add node data functions here,
        // because this calls the relevant event listeners in GoJS.  -seventynine.
        myDiagram.model.removeNodeData(myDiagram.model.nodeDataArray[0]);
        myDiagram.model.removeNodeData(myDiagram.model.nodeDataArray[0]);
        myDiagram.model.addNodeData(interesting_citizens);
        myDiagram.model.addNodeData(vectis_agents);
        timesClicked++;

        showModel();
    };
  }