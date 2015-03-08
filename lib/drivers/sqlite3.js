var driver = {

  getConnection: function(url, /*unused*/ props){
    return java.sql.DriverManager.getConnection(url);
  },

  getColDefs: function(conn, schema, table){
    var sql = poorfmt("PRAGMA table_info('%s')", table);

    var colDefs = [];

    var stmt = conn.createStatement();
    var rs = stmt.executeQuery(sql);

    while(rs.next()){
      var no = "" + rs.getInt(1);
      var name = "" + rs.getString(2);
      var type = "" + rs.getString(3);
      // 4: not null
      // 5: default value
      var keyseq = "" + rs.getInt(6);

      colDefs.push({
        no: parseInt(no, 10) + 1,
        name: name,
        type: type,
        pk: (keyseq === "0" ? null : parseInt(keyseq, 10))
      });
    }

    rs.close();
    stmt.close();

    return colDefs;
  }
};

exports.driver = driver;
