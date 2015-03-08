var driver = {
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
};

exports.driver = driver;
