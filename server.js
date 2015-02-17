(function(){
  var global = this;
  var stdLibDir = "" + java.lang.System.getenv("JJS_STDLIB_DIR");
  global.__FILE__ = (new File("./").getCanonicalPath()
      + "/" + engine.get(engine.FILENAME))
    .replace( /\\/g, "/");
  global.LOAD_PATH = [
    __FILE__.replace( /^(.*)\/.+?$/, '$1' ),
    stdLibDir
  ];
  load(stdLibDir + "/init_jrunscript.js");
  load(stdLibDir + "/my_init.js");
})();

////////////////////////////////

importClass(com.sun.net.httpserver.HttpExchange);
importClass(com.sun.net.httpserver.HttpHandler);
importClass(com.sun.net.httpserver.HttpServer);
importClass(java.io.File);
importClass(java.io.IOException);
importClass(java.io.InputStream);
importClass(java.io.OutputStream);
importClass(java.io.PrintWriter);
importClass(java.net.InetSocketAddress);
importClass(java.util.HashMap);
importClass(java.util.Map);

////////////////////////////////

require("lib/json2/json2"); //=> JSON
var _ = require("lib/underscore/underscore");
var HttpUtils = require("lib/http_utils");
var HttpExchangeWrapper = require("lib/http_exchange_wrapper");
var Optparse = require("lib/optparse");

////////////////////////////////

GLOBAL = {
  isDebug: false,
  config: null
};

function isDebug(){
  return GLOBAL.isDebug;
}

var APP_ROOT = _File.dirname(__FILE__);

function requireAppLib(path){
  return require(APP_ROOT + "/" + path);
}

////////////////////////////////

(function(args){
  var opts = Optparse.parse(args, [
    ["--config", true],
    ["--debug"]
  ]);

  var configPath = "config.json";
  if(opts.has("--config")){
    configPath = opts.valueOf("--config");
  }
  putskv("config path", configPath);

  GLOBAL.config = JSON.parse(_File.read(configPath));

  if(opts.has("--debug")){
    GLOBAL.isDebug = true;
  }
})(arguments);

if(isDebug()){
  putskv("config", JSON.stringify(GLOBAL.config));
}

////////////////////////////////

var Kijitora = require("lib/kijitora/kijitora");
var app = requireAppLib("app");
var conn;

function getMethod(hew, req){
  var method = hew.getMethod().toUpperCase();
  if(req.params._method){
    method = req.params._method.toUpperCase();
  }
  return method;
}

function handler(he){

  var hew = new HttpExchangeWrapper(he);

  try{

    if(isDebug()){
      app = requireAppLib("app");
    }

    var path = hew.getPath();

    var req = new HttpUtils.Request();
    req.params = hew.getParams();

    var res = new HttpUtils.Response();
    var method = getMethod(hew, req);

    app.dispatch(method, path, req, res);

    if(res.filePath){
      hew.writeFile(res.filePath);
    }else{
      if(res.contentType){
        hew.addResponseHeaders({ "Content-Type": res.contentType });
      }
      hew.writeString(res.status, res.body);
    }

  }catch(e){
    dump(e);
    var html = HttpUtils.makeErrorPageHtml(e, isDebug());
    hew.writeString(500, html);
  }finally{
    hew.close();
  }
}

(function(){
  var PORT = GLOBAL.config["port"];

  var server = HttpServer.create(
    new InetSocketAddress("localhost", PORT), 0);
  
  puts("server start at port " + PORT);

  server.createContext(
    "/", new HttpHandler({handle : handler})
  );

  server.start();

  java.lang.Thread.currentThread().suspend(); 
})();
