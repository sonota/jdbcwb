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

    multiQuery: function(sqls, fnOk, fnNg){
      $.post("/api/query", {
        mode: null,
        sqls: JSON.stringify(sqls)
      }).done(function(data){
        _g.appM.set("ajaxResponse", JSON.stringify(data));

        if(data.status === 'OK'){
          fnOk(data);
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

      Database.multiQuery([sql], function(data){
        var result = data.results[0];
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

  _g.ResultBoxM = Backbone.Model.extend({
    defaults: {
      numRows: null,
      rows: [],
      colDefs: []
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

    _g.genericOperationV = new _g.GenericOperationV();

    _g.appM = new _g.AppM();
    _g.appV = new _g.AppV({
      model: _g.appM
    });
  };

})();

////////////////////////////////

$(Jdbcwb.start); 
