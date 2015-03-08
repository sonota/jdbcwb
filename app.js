var app = Kijitora.App.create(APP_ROOT);

var FETCH_LIMIT = 100;

////////////////////////////////

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

var driverMap = {
  "mysql": {
    getConnection: function(url, props){
      return new Packages.com.mysql.jdbc.Driver().connect(
        url, props);
    },

    getColDefsForTable: function(conn, schema, table){
      var template = lines2text(
        "SELECT ORDINAL_POSITION, COLUMN_NAME, COLUMN_KEY, DATA_TYPE",
        "FROM INFORMATION_SCHEMA.COLUMNS",
        "WHERE 1=1",
        "  AND TABLE_SCHEMA = '%s' ",
        "  AND TABLE_NAME = '%s'   "
      );
      var sql = poorfmt(template, schema, table);
      puts(sql);

      var colDefs = [];

      var stmt = conn.createStatement();
      var rs = stmt.executeQuery(sql);
      while(rs.next()){
        var no = parseInt(rs.getString(1), 10);
        var name = "" + rs.getString(2);

        var keyseq;
        if(rs.getObject(3) == null){
          keyseq = null;
        }else{
          var s = "" + rs.getString(3);
          keyseq = (s === "PRI") ? 1 : null;
        }
        var type = "" + rs.getString(4);

        colDefs.push({
          no: no, name: name, type: type, pk: keyseq
        });
      }

      rs.close();
      stmt.close();

      if(colDefs.length === 0){
        throw new Error("colDefs not found: schema (" + schema + ")");
      }

      return colDefs;
    }
  }
};

/**
 * Database Driver Factory
 */
function getDriver(){
  if(GLOBAL.driver){
    return GLOBAL.driver;
  }

  var config = GLOBAL.config.db;

  if(config.type in driverMap){
    GLOBAL.driver = driverMap[config.type];
  }else{
    throw new Error("config.db.type is invalid (" + config.type + ")");
  }

  return GLOBAL.driver;
}

function getConnection(){
  if( GLOBAL.conn && ! GLOBAL.conn.isClosed() ){
    return GLOBAL.conn;
  }

  var config = GLOBAL.config.db;

  puts_debug(JSON.stringify(config));
  var _props = new java.util.Properties();
  for(var k in config.props){
    _props.put(k, config.props[k]);
  }

  GLOBAL.conn = getDriver().getConnection(config.url, _props);

  // java.sql.DatabaseMetaData
  var dbmd = GLOBAL.conn.getMetaData();
  putskv("JDBC major version", dbmd.getJDBCMajorVersion());

  GLOBAL.canScroll = dbmd.supportsResultSetType(
    java.sql.ResultSet.TYPE_SCROLL_INSENSITIVE);
  putskv("ResultSet.TYPE_SCROLL_INSENSITIVE", GLOBAL.canScroll);

  return GLOBAL.conn;
}


function getMetaData(rs){
  var md = rs.getMetaData();
  var numCols = md.getColumnCount();
  puts_debug("numCols=" + numCols);
  var mds = [];
  for(var i=0; i<numCols; i++){
    var n = i + 1;
    mds.push({
      no: n,
      name: "" + md.getColumnLabel(n),
      type: "" + md.getColumnTypeName(n),
      pk: null
    });
  }
  return mds;
}

////////////////////////////////

var Record = (function(){

  function Record(){
    this.cols = [];
  };
  var __ = Record.prototype;

  Record.fromRs = function(rs, md){
    var numCols = md.length;
    var rec = new Record();
    for(var i=0; i<numCols; i++){
      var val = rs.getObject(i + 1);
      if(val === null){
        rec.set(i, null);
      }else if( md[i].type === "INTEGER" ){
        rec.set(i, parseInt("" + val, 10));
      }else{
        rec.set(i, "" + val);
      }
    }
    return rec;
  };

  __.set = function(i, val){
    this.cols[i] = val;
  };

  return Record;
})();

function rs2recs(rs, md, limit){
  var recs = [];
  var i = 0;
  while(rs.next() && i < limit){
    recs.push(Record.fromRs(rs, md));
    i++;
  }
  return recs;
}

////////////////////////////////

function date2str(date){
  return "" + date.getTime() + "_" + prettyDatetime(date);
}

function getView(name){
  var path = APP_ROOT + "/views/" + name + ".html";
  return _File.read(path);
}

function _api(req, res, fn){
  res.setContentType("application/json");
  var data;
  try{
    puts_debug(req.params.json);
    data = fn(req, res, JSON.parse(req.params.json));
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

////////////////////////////////

function query(conn, sql, params){
  var stmt;
  if(GLOBAL.canScroll){
    stmt = conn.createStatement(
      java.sql.ResultSet.TYPE_SCROLL_INSENSITIVE,
      java.sql.ResultSet.CONCUR_READ_ONLY
    );
  }else{
    stmt = conn.createStatement();
  }

  var execTime = new Date();
  var rs = stmt.executeQuery(sql);

  // 全体（limitなし）の件数を取得
  var numRowsAll = null;
  if(GLOBAL.canScroll){
    rs.last();
    numRowsAll = rs.getRow();
    rs.beforeFirst();
  }

  var md = getMetaData(rs);
  var recs = rs2recs(rs, md, FETCH_LIMIT);
  puts_debug("" + recs.length + " rows");

  rs.close();
  stmt.close();

  puts_debug("mode=" + params.mode);
  var colDefs;
  if(params.mode === 'single_table'){
    colDefs = getDriver().getColDefsForTable(
      conn, params.schema, params.table);
  }else{
    colDefs = md;
  }

  return {
    sql: sql,
    rows: _.map(recs, function(rec){
      return rec.cols;
    }),
    numRows: recs.length,
    numRowsAll: numRowsAll, // limit なしの件数
    timestamp: date2str(execTime),
    colDefs: colDefs
  };
}


app.post("/api/query", function(req, res){
  return _api(req, res, function(req, res, params){

    var sqls = params.sqls;

    var conn = getConnection();

    var results = _.map(sqls, function(sql){
      return query(conn, sql, params);
    });

    return {
      status: "OK",
      results: results
    };
  });
});

////////////////////////////////

function update(params){
  var conn = getConnection();

  var sql = params.sql;
  var sqlParams = params.params;

  var stmt = conn.prepareStatement(sql);
  _.each(sqlParams, function(sqlParam, i){
    stmt.setObject(i + 1, sqlParam);
  });

  var execTime = new Date();
  var count = stmt.executeUpdate();

  puts_debug("count=" + count);

  stmt.close();

  return {
    status: "OK",
    count: count,
    timestamp: date2str(execTime)
  };
}

app.post("/api/update", function(req, res){
  return _api(req, res, function(req, res, params){

    return update(params);
  });
});

exports.app = app;
