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

  function escapeBackslash(str){
    if(str == null) return null;
    return JSON.stringify(str)
        .replace(/^"/, "")
        .replace(/"$/, "");
  }

  function unescapeBackslash(str){
    if(str == null) return null;
    return JSON.parse('"' + str + '"');
  }

  function toggleBool(model, name){
    model.set(name, ! model.get(name));
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
      var content;
      if(col == null){
        content = '<span class="col_null">(null)</span>';
      }else if(col === ''){
        content = '<span class="col_blank">(blank)</span>';
      }else{
        if(_g.appM.get("snipLongContent")){
          content = snipLongContent(col);
        }
      }
      inner += '<td>'+ content +'</td>';
    });
    return inner;
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
    }
  });

  _g.AppV = Backbone.View.extend({

    el: "body",

    events: {
      "click .snip_long_content": function(){
        toggleBool(this.model, "snipLongContent");
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

    doQuery: function(sql, fnOk, fnNg){
      var resboxM = _g.genericOperationResultBoxM;
      Database.singleQuery('generic', null, null, sql, function(result){
        resboxM.setResult(result);
        fnOk();
      }, function(data){
        fnNg();
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

    doQuery: function(schema, tablePName, fnOk, fnNg){
      var resboxM = _g.tableEditResultBoxM;
      var sql = this.makeSql(tablePName);

      Database.singleQuery('single_table', schema, tablePName, sql, function(result){
        // OK
        resboxM.setResult(result);
        fnOk();
      }, function(data){
        // NG
        fnNg();
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
      numRowsAll: null,
      rows: [],
      colDefs: []
    },

    reset: function(){
      this.set("data", {
        colDefs: [],
        rows: [],
        numRows: null,
        numRowsAll: null
      });
      this.set("colDefs", [], {silent: true});
      this.set("rows", [], {silent: true});
      this.set("numRows", null, {silent: true});
      this.set("numRowsAll", null, {silent: true});
      this.trigger("change");
    },

    setResult: function(result){
      this.set("colDefs", result.colDefs, {silent: true});
      this.set("rows", result.rows, {silent: true});
      this.set("numRows", result.numRows, {silent: true});
      this.set("numRowsAll", result.numRowsAll, {silent: true});
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
        var rowV = new _g.RowV({
          model: new _g.RowM({ ri: ri, cols: cols })
        });
        me.rowVs.push(rowV);

        me.listenTo(rowV, "click", function(rowV, evTarget){
          me.onClickRow(rowV, evTarget);
        });
        $tbody.append(rowV.render().el);
      });
    },

    render: function(){
      // clear
      this.$(".result thead").empty();
      this.$(".result tbody").empty();

      var numRows = this.model.get("numRows");
      var numRowsAll = this.model.get("numRowsAll");
      this.$(".num_rows").text(numRows != null ? numRows : "-");
      this.$(".num_rows_all").text(numRowsAll != null ? numRowsAll : "-");

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

      _g.editPromptV.show(escapeBackslash(preVal), function(postValEsc){
        var postVal = unescapeBackslash(postValEsc);
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

    tagName: "tr",

    events: {
      "click": function(ev){
        this.trigger("click", this, ev.target);
      }
    },

    initialize: function(){
      this.listenTo(this.model, "change", this.render);
    },

    render: function(){
      this.$el.html(makeDataRows(
        this.model.get("cols"),
        this.model.get("ri")
      ));

      return this;
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

    initialize: function(){
      this.on("change:value", this.onChangeValue);
    },

    onChangeValue: function(){
      var numChars;
      this.set("isInvalid", false);
      if(this.get("isNull")){
        numChars = null;
      }else{
        try{
          numChars = unescapeBackslash(this.get("value")).length;
        } catch (ex) {
          this.set("isInvalid", true);
        }
      }
      this.set("numChars", numChars);
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
      "click .guard_layer": "close",
      "click .is_null": "onClickIsNull",
      "input .edit": "onInputValue"
    },

    initialize: function(){
      this.listenTo(this.model, "change", this.render);
    },

    render: function(){
      var $ta = this.$("textarea.edit");
      var isNull = this.model.get("isNull");
      if(isNull){
        this.$(".num_chars").text("-");
      }else{
        this.$(".num_chars").text(this.model.get("numChars"));
      }
      $ta.val(this.model.get("value"));
      $ta.prop("disabled", isNull);
      this.$(".is_null").prop("checked", isNull);

      $ta.removeClass("invalid");
      if(this.model.get("isInvalid")){
        $ta.addClass("invalid");
      }
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
      toggleBool(this.model, "isNull");
    },

    onInputValue: function(){
      var $ta = this.$("textarea.edit");
      this.model.set("value", $ta.val());
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
