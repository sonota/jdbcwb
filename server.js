(function(){
  var global = this;
  var stdLibDir = "" + java.lang.System.getenv("JJS_STDLIB_DIR");
  global.__FILE__ = (new File("./").getCanonicalPath()
      + "/" + engine.get(engine.FILENAME))
    .replace( /\\/g, "/");
  global.LOAD_PATH = [
    __FILE__.replace( /^(.*)\/.+?$/, '$1' ),
    stdLibDir + "/lib"
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

require("json2/json2"); //=> JSON
var _ = require("underscore/underscore");
var HttpUtils = require("http_utils");
var HttpExchangeWrapper = require("http_exchange_wrapper");
var Optparse = require("optparse");

////////////////////////////////

GLOBAL = {
  debug: false,
  config: null,
  conn: null
};

function isDebug(){
  return GLOBAL.debug;
}

function puts_debug(){
  if(isDebug()) puts.apply(this, arguments);
}

var APP_ROOT = _File.dirname(__FILE__);

function requireAppLib(path){
  return require(APP_ROOT + "/" + path);
}

function padRight(width, pad, x){
  var s = "" + x;
  while(s.length < width){
    s = pad + s;
  }
  return s;
}

function prettyDatetime(date){
  return    padRight(4, "0", date.getFullYear())
    + "-" + padRight(2, "0", date.getMonth() + 1)
    + "-" + padRight(2, "0", date.getDate())
    + "_" + padRight(2, "0", date.getHours())
    + ":" + padRight(2, "0", date.getMinutes())
    + ":" + padRight(2, "0", date.getSeconds())
    + "." + padRight(3, "0", date.getMilliseconds());
}

function join(xs, sep){
  var s = "";
  _.each(xs, function(x, i){
    if(i >= 1){ s += sep; }
    s += x;
  });
  return s;
}

function lines2text(){
  return join(arguments, "\n") + "\n";
}

////////////////////////////////

/**
 * - parse command line options
 * - load config
 */
function init(args){
  var opts = Optparse.parse(args, [
    ["--config", true],
    ["--debug"]
  ]);

  if(opts.has("--debug")){
    GLOBAL.debug = true;
  }

  var configPath = "config.json";
  if(opts.has("--config")){
    configPath = opts.valueOf("--config");
  }
  putskv("config path", configPath);

  GLOBAL.config = JSON.parse(_File.read(configPath));

  if(isDebug()){
    putskv("config", JSON.stringify(GLOBAL.config));
  }
}

////////////////////////////////

var Kijitora = require("kijitora/kijitora");
var app = requireAppLib("app");

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

    if(path === "/favicon.ico"){
      hew.writeString(404, "");
      hew.close();
      return;
    }

    var req = new HttpUtils.Request();
    req.params = hew.getParams();

    var res = new HttpUtils.Response();
    var method = getMethod(hew, req);

    puts("" + prettyDatetime(new Date()) + " " + method + " " + path);

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
    if(typeof e === "string"){
      puts(e);
    }else{
      dump(e);
    }
    var html = HttpUtils.makeErrorPageHtml(e, isDebug());
    hew.writeString(500, html);
  }finally{
    hew.close();
  }
}

(function(args){

  init(args);

  var PORT = GLOBAL.config["port"];

  var server = HttpServer.create(
    new InetSocketAddress("localhost", PORT), 0);
  
  puts("server start at port " + PORT);

  server.createContext(
    "/", new HttpHandler({handle : handler})
  );

  server.start();

  java.lang.Thread.currentThread().suspend(); 
})(arguments);
