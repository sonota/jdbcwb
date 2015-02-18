var app = Kijitora.App.create(APP_ROOT);

////////////////////////////////

function getView(name){
  var path = APP_ROOT + "/views/" + name + ".html";
  return _File.read(path);
}

function _api(req, res, fn){
  res.setContentType("application/json");
  var data;
  try{
    data = fn(req, res);
  } catch (ex) {
    dump(ex);
    data = {
      status: "NG",
      ex: {
        message: ex.message,
        name: ex.name,
        fileName: ex.fileName,
        lineNumber: ex.lineNumber
      }
    };
  }
  var json = JSON.stringify(data);
  res.send(json);
}

////////////////////////////////

app.get("/jdbcwb", function(req, res){
  res.send(getView("main"));
});

app.post("/api/query", function(req, res){
  return _api(req, res, function(req, res){
    // TODO
    return {
      status: "OK",
      results: []
    };
  });
});

app.post("/api/update", function(req, res){
  return _api(req, res, function(req, res){
    // TODO
    return {
      status: "OK"
    };
  });
});

exports.app = app;
