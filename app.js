var app = Kijitora.App.create(APP_ROOT);

////////////////////////////////

function getView(name){
  var path = APP_ROOT + "/views/" + name + ".html";
  return _File.read(path);
}

////////////////////////////////

app.get("/jdbcwb", function(req, res){
  res.send(getView("main"));
});

exports.app = app;
