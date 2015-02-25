function puts(){
  console.log.apply(console, arguments);
}

// global namespace
var Jdbcwb = {};

(function(){

  "use strict";

  var _g = Jdbcwb; // global namespace alias

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
      _g.appV.guard();

      var sql = this.$("textarea").val();
      $.post("/api/query", {
        sqls: JSON.stringify([sql])
      }, function(data){
        _g.appM.set("ajaxResponse", JSON.stringify(data));
        _g.appV.unguard();
      });
    },

    doUpdate: function(){
      _g.appV.guard();

      var sql = this.$("textarea").val();
      $.post("/api/update", {
        sql: sql
      }, function(data){
        _g.appM.set("ajaxResponse", JSON.stringify(data));
        _g.appV.unguard();
      });
    }
  });

  ////////////////////////////////

  _g.start = function(){
    _g.genericOperationV = new _g.GenericOperationV();

    _g.appM = new _g.AppM();
    _g.appV = new _g.AppV({
      model: _g.appM
    });
  };

})();

////////////////////////////////

$(Jdbcwb.start); 
