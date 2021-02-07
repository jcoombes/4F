function init() {
    var $ = go.GraphObject.make;
    var myDiagram =
        $(go.Diagram, "myDiagramDiv");
    
    var myModel = $(go.GraphLinksModel);
    myModel.nodeDataArray = [
        {key: "Alpha"},
        {key: "Beta"},
        {key: "Gamma"},
    ];
    
    myModel.linkDataArray = [
        {from: "Alpha", to: "Gamma"},
    ];
    
    myDiagram.model = myModel;
    
}