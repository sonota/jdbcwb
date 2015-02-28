function puts(){
  console.log.apply(console, arguments);
}

// global namespace
var Jdbcwb = {};

(function(){

  "use strict";

  var _g = Jdbcwb; // global namespace alias

  ////////////////////////////////

  var Database = {

    singleQuery: function(mode, schema, tablePName, sql, fnOk, fnNg){
      this.multiQuery(mode, schema, tablePName, [sql], function(results){
        fnOk(results[0]);
      }, fnNg);
    },

    multiQuery: function(mode, schema, tablePName, sqls, fnOk, fnNg){
      $.post("/api/query", {
        mode: mode,
        schema: schema,
        table: tablePName,
        sqls: JSON.stringify(sqls)
      }).done(function(data){
        _g.appM.set("ajaxResponse", JSON.stringify(data));

        if(data.status === 'OK'){
          fnOk(data.results);
        }else{
          console.error(data.ex); // TODO
          fnNg(data);
        }
      });
    },

    update: function(sql, fnOk, fnNg){
      $.post("/api/update", {
        sql: sql
      }, function(data){
        _g.appM.set("ajaxResponse", JSON.stringify(data));

        if(data.status === 'OK'){
          fnOk(data);
        }else{
          console.error(data.ex); // TODO
          fnNg(data);
        }
      });
    }
  };

  ////////////////////////////////

  _g.AppM = Backbone.Model.extend({
    defaults: {
      ajaxResponse: ""
    }
  });

  _g.AppV = Backbone.View.extend({

    el: "body",

    initialize: function(){
      this.listenTo(this.model, "change", this.render.bind(this));
    },

    render: function(){
      $("#ajax_response").val(this.model.get("ajaxResponse"));
    },

    guard:   function(){ this.$("#guard_layer").show(); },
    unguard: function(){ this.$("#guard_layer").hide(); }
  });

  ////////////////////////////////

  _g.GenericOperationV = Backbone.View.extend({

    el: "#_generic_operation",

    events: {
      "click .btn_query": "doQuery",
      "click .btn_update": "doUpdate"
    },

    doQuery: function(){
      var resboxM = _g.genericOperationResultBoxM;
      _g.appV.guard();

      var sql = this.$("textarea").val();

      Database.singleQuery('generic', null, null, sql, function(result){
        resboxM.set("numRows", result.numRows, {silent: true});
        resboxM.set("colDefs", result.colDefs, {silent: true});
        resboxM.set("rows", result.rows, {silent: true});
        resboxM.trigger("change");
        _g.appV.unguard();
      }, function(data){
        _g.appV.unguard();
      });
    },

    doUpdate: function(){
      var resboxM = _g.genericOperationResultBoxM;
      _g.appV.guard();

      var sql = this.$("textarea").val();

      Database.update(sql, function(data){
        resboxM.set("numRows", data.count);
        _g.appV.unguard();
      }, function(data){
        _g.appV.unguard();
      });
    }
  });

  ////////////////////////////////

  _g.TableEditM = Backbone.Model.extend();

  _g.TableEditV = Backbone.View.extend({
    
    el: "#_table_edit",

    events: {
      "click .btn_query": "doQuery"
    },

    doQuery: function(ev){
      ev.preventDefault();
      var me = this;
      var resboxM = _g.tableEditResultBoxM;

      _g.appV.guard();
      // _g.appV.hideMsg(); // TODO
      resboxM.reset();
      this.colDefs = null;

      var schema = this.$("[name=schema]").val();
      var tablePName = this.$("[name=table_pname]").val();
      var sql = this.makeSql(tablePName);

      Database.singleQuery('single_table', schema, tablePName, sql, function(result){
        // OK
        resboxM.set("numRows", result.numRows, {silent: true});
        resboxM.set("colDefs", result.colDefs, {silent: true});
        resboxM.set("rows", result.rows, {silent: true});
        resboxM.trigger("change");
        _g.appV.unguard();
      }, function(data){
        // NG
        _g.appV.unguard();
      });
    },

    makeSql: function(tablePName){
      return [
        "SELECT *",
        "FROM " + tablePName
      ].join("\n");
    }
  });

  ////////////////////////////////

  _g.ResultBoxM = Backbone.Model.extend({
    defaults: {
      numRows: null,
      rows: [],
      colDefs: []
    },

    reset: function(){
      this.set("data", {
        colDefs: [],
        rows: [],
        numRows: "-",
        numRowsAll: "-"
      });
      this.set("colDefs", [], {silent: true});
      this.set("rows", [], {silent: true});
      this.set("numRows", "-", {silent: true});
      this.set("numRowsAll", "-", {silent: true});
      this.trigger("change");
    }
  });

  _g.ResultBoxV = Backbone.View.extend({
    initialize: function(){
      this.listenTo(this.model, "change", this.render.bind(this));
    },

    render: function(){
      // clear
      this.$(".result thead").empty();
      this.$(".result tbody").empty();

      var numRows = this.model.get("numRows");
      this.$(".num_rows").text(numRows != null ? numRows : "-");

      // header
      var $thead = this.$(".result thead");
      var $tr = $('<tr><th>#</th></tr>');
      _.each(this.model.get("colDefs"), function(colDef){
        $tr.append('<th>' + colDef.name + '</th>');
      });
      $thead.append($tr);

      // rows
      var $tbody = this.$(".result tbody");
      _.each(this.model.get("rows"), function(row, ri){
        var rn = ri + 1;
        var $tr = $('<tr><th>'+rn+'</th></tr>');
        _.each(row, function(col){
          $tr.append('<td>'+ _.escape(col) +'</td>');
        });
        $tbody.append($tr);
      });
    }
  });

  ////////////////////////////////

  _g.start = function(){

    _g.genericOperationResultBoxM = new _g.ResultBoxM();
    _g.genericOperationResultBoxV = new _g.ResultBoxV({
      el: $("#_generic_operation ._result_box"),
      model: _g.genericOperationResultBoxM
    });

    _g.tableEditResultBoxM = new _g.ResultBoxM();
    _g.tableEditResultBoxV = new _g.ResultBoxV({
      el: $("#_table_edit ._result_box"),
      model: _g.tableEditResultBoxM
    });

    _g.genericOperationV = new _g.GenericOperationV();
    _g.tableEditV = new _g.TableEditV();

    _g.appM = new _g.AppM();
    _g.appV = new _g.AppV({
      model: _g.appM
    });
  };

})();

////////////////////////////////

$(Jdbcwb.start); 
