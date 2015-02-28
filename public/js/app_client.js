function puts(){
  console.log.apply(console, arguments);
}

// global namespace
var Jdbcwb = {};

(function(){

  "use strict";

  var _g = Jdbcwb; // global namespace alias

  var COL_CONTENT_LENGTH_MAX = 32;

  ////////////////////////////////

  function snipLongContent(str){
    if(str == null){
      return null;
    }
    if(str.length > COL_CONTENT_LENGTH_MAX){
      var snip = "...";
      var half = Math.floor((COL_CONTENT_LENGTH_MAX - snip.length) / 2);
      var head = str.substring(0, half);
      var tail = str.substring(str.length - half, str.length);
      str = head + '<span class="col_snip">' + snip + '</span>' + tail;
    }
    return str;
  }

  function isPrimaryKey(colDefs, ci){
    var cn = ci + 1;
    var found = false;
    colDefs.forEach(function(colDef, i){
      if(colDef.no === cn && colDef.pk !== null){
        found = true;
      }
    });
    return found;
  }

  function escapeForSql(val){
    if(val === null){
      return "NULL";
    }
    return "'" + ("" + val).replace( /'/g, "''") + "'";
  }

  ////////////////////////////////
  // Table Utilities

  function makeHeaderRows(
    // colPNames,
    colDefs){
    var inner = "<th>#</th>";
    _.each(colDefs, function(colDef){
      inner += '<th>' + colDef.name + '</th>';
    });
    return '<tr>' + inner + '</tr>';
  }

  function makeDataRows(row, ri){
    var inner = '<th>' + (ri + 1) + '</th>';
    _.each(row, function(col){
      var content = col;
      if(_g.appM.get("snipLongContent")){
        content = snipLongContent(col);
      }
      inner += '<td>'+ content +'</td>';
    });
    return '<tr>' + inner + '</tr>';
  }

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
      ajaxResponse: "",
      snipLongContent: true
    },

    toggleSnipLongContent: function(){
      this.set("snipLongContent", ! this.get("snipLongContent") );
    }
  });

  _g.AppV = Backbone.View.extend({

    el: "body",

    events: {
      "click .snip_long_content": function(){
        this.model.toggleSnipLongContent();
      }
    },

    initialize: function(){
      this.listenTo(this.model, "change", this.render);
    },

    render: function(){
      $("#ajax_response").val(this.model.get("ajaxResponse"));
      this.$(".snip_long_content")
          .prop("checked", this.model.get("snipLongContent"));
    },

    guard:   function(){ this.$("#guard_layer").show(); },
    unguard: function(){ this.$("#guard_layer").hide(); }
  });

  ////////////////////////////////

  _g.GenericOperationM = Backbone.Model.extend({

    doQuery: function(sql, viewFnOk, viewFnNg){
      var resboxM = _g.genericOperationResultBoxM;
      Database.singleQuery('generic', null, null, sql, function(result){
        resboxM.setResult(result);
        viewFnOk();
      }, function(data){
        viewFnNg();
      });
    }
  });

  _g.GenericOperationV = Backbone.View.extend({

    el: "#_generic_operation",

    events: {
      "click .btn_query": "doQuery",
      "click .btn_update": "doUpdate"
    },

    doQuery: function(){
      var resboxM = _g.genericOperationResultBoxM;

      _g.appV.guard();
      resboxM.reset();

      var sql = this.$("textarea").val();

      this.model.doQuery(sql, function(){
        _g.appV.unguard();
      }, function(){
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

  _g.TableEditM = Backbone.Model.extend({

    doQuery: function(schema, tablePName, viewFnOk, viewFnNg){
      var resboxM = _g.tableEditResultBoxM;
      var sql = this.makeSql(tablePName);

      Database.singleQuery('single_table', schema, tablePName, sql, function(result){
        // OK
        resboxM.setResult(result);
        viewFnOk();
      }, function(data){
        // NG
        viewFnNg();
      });
    },

    makeSql: function(tablePName){
      return [
        "SELECT *",
        "FROM " + tablePName
      ].join("\n");
    }
  });

  _g.TableEditV = Backbone.View.extend({
    
    el: "#_table_edit",

    events: {
      "click .btn_query": "doQuery"
    },

    doQuery: function(ev){
      ev.preventDefault();
      var resboxM = _g.tableEditResultBoxM;

      _g.appV.guard();
      // _g.appV.hideMsg(); // TODO
      resboxM.reset();
      this.colDefs = null;

      var schema = this.$("[name=schema]").val();
      var tablePName = this.$("[name=table_pname]").val();

      this.model.doQuery(schema, tablePName, function(){
        _g.appV.unguard();
      }, function(){
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
    },

    setResult: function(result){
      this.set("numRows", result.numRows, {silent: true});
      this.set("colDefs", result.colDefs, {silent: true});
      this.set("rows", result.rows, {silent: true});
      this.trigger("change");
    },

    doUpdate: function(sql, fnOk, fnNg){
      Database.update(sql, fnOk, fnNg);
    }
  });

  _g.ResultBoxV = Backbone.View.extend({
    initialize: function(){
      this.rowVs = [];
      this.listenTo(this.model, "change", this.render);
    },

    _renderNormalView: function(){
      var me = this;

      // header
      this.$(".result thead").append(makeHeaderRows(
        // colPNames,
        this.model.get("colDefs")
      ));

      // rows
      var $tbody = this.$(".result tbody");
      _.each(this.model.get("rows"), function(cols, ri){
        var $tr = $(makeDataRows(cols, ri));

        var rowV = new _g.RowV({
          el: $tr,
          model: new _g.RowM({ cols: cols })
        });
        me.rowVs.push(rowV);

        me.listenTo(rowV, "click", function(rowV, evTarget){
          me.onClickRow(rowV, evTarget);
        });
        $tbody.append($tr);
      });
    },

    render: function(){
      // clear
      this.$(".result thead").empty();
      this.$(".result tbody").empty();

      var numRows = this.model.get("numRows");
      this.$(".num_rows").text(numRows != null ? numRows : "-");

      this.rowVs = [];
      this._renderNormalView();
    },

    onClickRow: function(rowV, evTarget){
      // TODO th case
      var $td = $(evTarget).closest("td");
      var ci = rowV.tdToCi($td.get(0));
      if( ! this.isPrimaryKey(ci)){
        // 編集可能部分をクリックした場合
        this.editValue($td, ci);
      }
    },

    editValue: function($td, ci){
      var me = this;
      // _g.appV.hideMsg(); // TODO

      var pname = this.getColDefByIdx(ci).name;

      var closestTr = $td.closest("tr").get(0);
      var ri;
      _.each(this.$("tbody tr"), function(tr, i){
        if(tr === closestTr){
          ri = i;
        }
      });
      var rowV = this.rowVs[ri];
      
      var preVal = rowV.model.getCol(ci);

      _g.editPromptV.show(preVal, function(postVal){
        rowV.model.setCol(ci, postVal);

        var pks = _.map(me.getPkDefs(), function(pkDef){
          return {
            pname: pkDef.name
            ,val: rowV.model.getCol(pkDef.no - 1)
          };
        });

        var sql = "UPDATE " + $("#_table_edit [name=table_pname]").val() // FIXME should get from resbox model
              + "\n" + "SET " + pname + " = " + escapeForSql(postVal)
              + "\n" + "WHERE 1=1"
              + "\n";

        pks.forEach(function(pk, i){
          var type = me.getColTypeByPName(pk.pname);
          sql += "  AND ";
          sql += pk.pname
          // + " /* "+ type +" */ "
              + " = " + escapeForSql(pk.val) + "\n";
        });
        // puts(sql);

        me.model.doUpdate(sql, function(data){
          // OK
        }, function(data){
          // NG
          // 変更前の値に戻す
          rowV.model.setCol(ci, preVal);
        });
      });
    },
    
    getColTypeByPName: function(pname){
      var type;
      this.model.get("colDefs").forEach(function(def){
        if(def.name === pname){
          type = def.type;
          return false;
        }
      });
      return type;
    },

    getPkDefs: function(){
      var pkDefs = _.filter(this.model.get("colDefs"), function(def){
        return def.pk != null;
      });
      return pkDefs;
    },

    getColDefByIdx: function(ci){
      var me = this;
      var cn = ci + 1;
      var def;
      _.each(this.model.get("colDefs"), function(it){
        if(it.no === cn){
          def = it;
          return false; // break
        }
      });
      return def;
    },

    isPrimaryKey: function(ci){
      return isPrimaryKey(this.model.get("colDefs"), ci);
    }
  });

  _g.RowM = Backbone.Model.extend({

    defaults: {
      cols: []
    },

    getCol: function(ci){
      return this.get("cols")[ci];
    },

    setCol: function(ci, val){
      var cols = this.get("cols");
      cols[ci] = val;
      this.set("cols", null, {silent: true});
      this.set("cols", cols);
    }
  });

  _g.RowV = Backbone.View.extend({
    events: {
      "click": function(ev){
        this.trigger("click", this, ev.target);
      }
    },

    tdToCi: function(td){
      var ci;
      this.$el.find("td").each(function(i, _td){
        if(_td === td){
          ci = i;
          return false; // break
        }
      });
      return ci;
    }
  });

  _g.EditPromptM = Backbone.Model.extend({
    toggleIsNull: function(){
      this.set("isNull", ! this.get("isNull") );
    }
  });

  _g.EditPromptV = Backbone.View.extend({

    el: "#_edit_prompt",

    events: {
      "click .btn_ok": function(){
        this.fnOk(this.val());
        this.close();
      },
      "click .btn_cancel": "close",
      "click .is_null": "onClickIsNull"
    },

    initialize: function(){
      this.listenTo(this.model, "change", this.render);
    },

    render: function(){
      var $ta = this.$("textarea.edit");
      var isNull = this.model.get("isNull");
      if(isNull){
        $ta.val("");
        this.$(".num_chars").text("-");
      }else{
        $ta.val(this.model.get("value"));
        this.$(".num_chars").text(this.model.get("numChars"));
      }
      $ta.prop("disabled", isNull);
      this.$(".is_null").prop("checked", isNull);
    },

    show: function(value, fnOk){

      this.fnOk = fnOk;

      var isNull = (value == null);
      this.model.set("isNull", isNull, {silent: true});
      this.model.set("value", value, {silent: true});
      this.model.set("numChars", isNull ? null : value.length, {silent: true});
      this.model.trigger("change");

      this.$el.show();
      this.$(".guard_layer").show();
    },

    close: function(){
      this.$el.hide();
    },

    val: function(){
      var $ta = this.$("textarea.edit");
      var v = null;
      if( ! this.model.get("isNull") ){
        v = $ta.val();
      }
      return v;
    },

    onClickIsNull: function(){
      this.model.toggleIsNull();
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

    _g.genericOperationM = new _g.GenericOperationM();
    _g.genericOperationV = new _g.GenericOperationV({
      model: _g.genericOperationM
    });
    
    _g.tableEditM = new _g.TableEditM();
    _g.tableEditV = new _g.TableEditV({
      model: _g.tableEditM
    });

    _g.editPromptM = new _g.EditPromptM();
    _g.editPromptV = new _g.EditPromptV({
      model: _g.editPromptM
    });

    _g.appM = new _g.AppM();
    _g.appV = new _g.AppV({
      model: _g.appM
    });
  };

})();

////////////////////////////////

$(Jdbcwb.start); 
