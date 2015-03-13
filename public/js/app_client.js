function puts(){
  console.log.apply(console, arguments);
}

// global namespace
var Jdbcwb = {};

(function(){

  "use strict";

  var _g = Jdbcwb; // global namespace alias

  // sample data
  var lnameMap = {
    "id": "ID",
    "name": "名前",
    "url": "URL",
    "created_at": "作成日時",
    "updated_at": "更新日時"
  };

  var COL_CONTENT_LENGTH_MAX = 32;
  var SNIP_STR = "...";
  var RE_WHITESPACE = new RegExp(
    "["
        + " "
        + String.fromCharCode(160) // NBSP
        + "]"
  );
  
  ////////////////////////////////

  function snipLongContent(str){
    if(str == null){
      return null;
    }
    var ret = {};
    var half = Math.floor((COL_CONTENT_LENGTH_MAX - SNIP_STR.length) / 2);
    ret.head = str.substring(0, half);
    ret.tail = str.substring(str.length - half, str.length);
    return ret;
  }

  function isPrimaryKey(colDefs, ci){
    var cn = ci + 1;
    return _.some(colDefs, function(colDef, i){
      return colDef.no === cn && colDef.pk !== null;
    });
  }

  function escapeForSql(val){
    if(val === null){
      return "NULL";
    }
    return "'" + ("" + val).replace(/'/g, "''") + "'";
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

  function htmlSpan(content, className){
    return '<span class="'+ className +'">' + content + '</span>';
  }

  function list2tsv(xs){
    return _.map(xs, function(x){
      if(x == null) return '"(null)"';
      if(x === "") return '"(blank)"';
      return '"' + escapeBackslash(x) + '"';
    }).join("\t");
  }

  function toLNames(pnames){
    return pnames.map(function(pname){
      return lnameMap[pname.toLowerCase()] || "-";
    });
  }


  ////////////////////////////////
  // Table Utilities

  function makeHeaderRows(
    // colPNames,
    colDefs){

    var inner = "";

    // column number
    inner += '<tr><th></th>';
    inner += _.map(_.range(1, colDefs.length + 1), function(cn){
      return '<th>' + cn + '</th>';
    }).join('');
    inner += '</tr>';

    // column pname
    var pnames = _.pluck(colDefs, "name");
    inner += '<tr><th></th>';
    _.each(colDefs, function(colDef){
      inner += '<th>' + colDef.name + '</th>';
    });
    inner += '</tr>';

    // column lname
    var lnames = toLNames(pnames);
    inner += '<tr><th>#</th>';
    _.each(lnames, function(lname){
      inner += '<th>' + lname + '</th>';
    });
    inner += '</tr>';

    return inner;
  }

  var escapeMap = {
    "\\": "\\\\",
    "\r": "\\r",
    "\n": "\\n",
    "\t": "\\t"
  };

  function makeColContentHtml(val){
    var temp = "" + val;
    var tokens = [];
    var buf = "";

    while(temp.length > 0){
      var ch0 = temp.charAt(0);
      if( /\\|\r|\n|\t/.test(ch0) ){
        if(buf.length > 0){
          tokens.push({type: "plain", str: buf});
          buf = "";
        }
        tokens.push({
          type: "html",
          str: htmlSpan(escapeMap[ch0], "col_ctrl_cd")
        });
      }else if( RE_WHITESPACE.test(ch0) ){
        if(buf.length > 0){
          tokens.push({type: "plain", str: buf});
          buf = "";
        }
        tokens.push({
          type: "html",
          str: htmlSpan("&nbsp;", "col_space")
        });
      }else{
        buf += ch0;
      }
      temp = temp.substring(1);
    }
    if(buf.length > 0){
      tokens.push({type: "plain", str: buf});
      buf = "";
    }

    var html = _.map(tokens, function(token){
      if(token.type === 'html'){
        return token.str;
      }else{
        return _.escape(token.str);
      }
    }).join("");

    return html;
  }

  function makeDataRows(row, ri){
    var inner = '<th>' + (ri + 1) + '</th>';
    _.each(row, function(col){
      var content;
      if(col == null){
        content = htmlSpan("(null)", "col_null");
      }else if(col === ''){
        content = htmlSpan("(blank)", "col_blank");
      }else{
        if(_g.appM.get("snipLongContent")
           && col.length > COL_CONTENT_LENGTH_MAX)
        {
          var snipRetVal = snipLongContent(col);
          content = makeColContentHtml(snipRetVal.head);
          content += htmlSpan(SNIP_STR, "col_snip");
          content += makeColContentHtml(snipRetVal.tail);
        }else{
          content = makeColContentHtml(col);
        }
      }
      inner += '<td>' + content + '</td>';
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
        json: JSON.stringify({
          mode: mode,
          schema: schema,
          table: tablePName,
          sqls: sqls
        })
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

    update: function(sql, params, fnOk, fnNg){
      $.post("/api/update", {
        json: JSON.stringify({
          sql: sql,
          params: params
        })
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

  var Converter = (function(){
    var __ = {};

    __.toTsv = function(rows, colDefs){

      var header = "";

      // column number
      header += list2tsv(_.range(1, colDefs.length + 1));

      // column pname
      var pnames = _.pluck(colDefs, "name");
      header += "\n" + list2tsv(pnames);

      // column lname
      header += "\n" + list2tsv(toLNames(pnames));

      // data
      var lines = _.map(rows, function(cols){
        return list2tsv(cols);
      });

      return header + "\n" + lines.join("\n") + "\n";
    };

    return __;
  })();

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

    defaults: {
      workText: ""
    },

    initialize: function(){
      var workText = localStorage.getItem("generic_operation_work_text");
      if(workText){ this.set("workText", workText); }

      this.on("change workText", function(){
        localStorage.setItem(
          "generic_operation_work_text",
          this.get("workText")
        );
        var workText = localStorage.getItem("generic_operation_work_text");
      });
    },

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

    initialize: function(){
      var me = this;
      
      this.editor = new Editor(this.$("._editor_box"));

      setInterval(function(){
        me.model.set("workText", me.editor.val());
      }, 1000 * 60);

      this.render();
    },

    render: function(){
      this.editor.val(this.model.get("workText"));
      return this;
    },

    doQuery: function(){
      var resboxM = _g.genericOperationResultBoxM;

      _g.appV.guard();
      resboxM.reset();

      var sql = this.editor.getSql();

      this.model.doQuery(sql, function(){
        _g.appV.unguard();
      }, function(){
        _g.appV.unguard();
      });
    },

    doUpdate: function(){
      var resboxM = _g.genericOperationResultBoxM;
      _g.appV.guard();

      var sql = this.editor.getSql();

      Database.update(sql, [], function(data){
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
        resboxM.set("schema", schema, {silent: true});
        resboxM.set("tablePName", tablePName, {silent: true});
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
      this.set({
        "colDefs": [],
        "rows": [],
        "numRows": null,
        "numRowsAll": null
      });
    },

    setResult: function(result){
      this.set({
        "colDefs": result.colDefs,
        "rows": result.rows,
        "numRows": result.numRows,
        "numRowsAll": result.numRowsAll
      });
    },

    doUpdate: function(sql, params, fnOk, fnNg){
      Database.update(sql, params, fnOk, fnNg);
    }
  });

  _g.ResultBoxV = Backbone.View.extend({

    events: {
      "click .btn_delete": "onClickDelete"
    },

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

        me.listenTo(rowV, "dblclick", function(rowV, evTarget){
          me.onDblclickRow(rowV, evTarget);
        });
        $tbody.append(rowV.render().el);
      });
    },

    render: function(){
      // clear
      this.$(".result thead").empty();
      this.$(".result tbody").empty();
      this.$(".tsv").val("");

      var numRows = this.model.get("numRows");
      var numRowsAll = this.model.get("numRowsAll");
      this.$(".num_rows").text(numRows != null ? numRows : "-");
      this.$(".num_rows_all").text(numRowsAll != null ? numRowsAll : "-");

      // table
      this.rowVs = [];
      this._renderNormalView();

      // TSV
      this.$(".tsv").val(Converter.toTsv(
        this.model.get("rows"),
        this.model.get("colDefs")
      ));
    },

    onDblclickRow: function(rowV, evTarget){
      var $td = $(evTarget).closest("td");
      var ci = rowV.tdToCi($td.get(0));
      if( ! this.isPrimaryKey(ci)){
        // 編集可能部分をクリックした場合
        this.editValue($td, ci);
      }
    },

    onClickDelete: function(){
      var me = this;
      _g.appV.guard();

      var tablePName = _g.tableEditResultBoxM.get("tablePName");

      var pkDefs = _.filter(this.model.get("colDefs"), function(def){
        return def.pk != null;
      });

      var rowMsToDel = _.chain(this.rowVs)
          .map(function(rowV){ return rowV.model; })
          .filter(function(rowM){ return rowM.get("isSelected"); })
          .value();

      _.each(rowMsToDel, function(rowM){
        // TODO mv to model
        var sql = "DELETE FROM " + tablePName
              + "\n" + "WHERE 1=1";
        var params = [];
        _.each(pkDefs, function(def, i){
          sql += "\n" + "  AND ";
          sql += def.name + " = ?";
          params.push(rowM.getCol(def.no - 1));
        });
        // puts(sql);

        rowM.doDelete(sql, params, function(){
          var newRowVs = _.filter(me.rowVs, function(rowV){
            return rowV.model !== rowM;
          });
          me.rowVs = newRowVs;

          _g.appV.unguard();
        }, function(){
          _g.appV.unguard();
        });
      });
    },

    editValue: function($td, ci){
      var me = this;
      // _g.appV.hideMsg(); // TODO

      var pname = this.getColDefByIdx(ci).name;

      var closestTr = $td.closest("tr").get(0);
      var ri = _.findIndex(this.$("tbody tr"), function(tr){
        return tr === closestTr;
      });
      var rowV = this.rowVs[ri];
      
      var preVal = rowV.model.getCol(ci);

      _g.editPromptV.show(escapeBackslash(preVal), function(postValEsc){
        var postVal = unescapeBackslash(postValEsc);
        rowV.model.setCol(ci, postVal);

        var pks = _.map(me.getPkDefs(), function(pkDef){
          return {
            pname: pkDef.name,
            val: rowV.model.getCol(pkDef.no - 1)
          };
        });

        var sql = "UPDATE " + _g.tableEditResultBoxM.get("tablePName")
              + "\n" + "SET " + pname + " = ?"
              + "\n" + "WHERE 1=1"
              + "\n";
        var params = [postVal];

        pks.forEach(function(pk, i){
          sql += "  AND " + pk.pname + " = ?";
          params.push(pk.val);
        });
        // puts(sql, params);

        me.model.doUpdate(sql, params, function(data){
          // OK
        }, function(data){
          // NG
          // 変更前の値に戻す
          rowV.model.setCol(ci, preVal);
        });
      });
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
      return _.find(this.model.get("colDefs"), function(it){
        return it.no === cn;
      });
    },

    isPrimaryKey: function(ci){
      return isPrimaryKey(this.model.get("colDefs"), ci);
    }
  });

  ////////////////////////////////

  _g.RowM = Backbone.Model.extend({

    defaults: {
      cols: [],
      isSelected: false
    },

    getCol: function(ci){
      return this.get("cols")[ci];
    },

    setCol: function(ci, val){
      var cols = this.get("cols");
      cols[ci] = val;
      this.set("cols", null, {silent: true});
      this.set("cols", cols);
    },

    doDelete: function(sql, params, fnOk, fnNg){
      var me = this;
      Database.update(sql, params, function(){
        me.trigger("delete");
        fnOk();
      }, fnNg);
    }
  });

  _g.RowV = Backbone.View.extend({

    tagName: "tr",

    events: {
      "click": function(ev){
        if(ev.target.tagName === "TH"){
          toggleBool(this.model, "isSelected");
        }
      },
      "dblclick": function(ev){
        this.trigger("dblclick", this, ev.target);
      }
    },

    initialize: function(){
      this.listenTo(this.model, "change", this.render);
      this.listenTo(this.model, "delete", function(){
        var me = this;
        this.$el.hide(1000, function(){
          me.$el.remove();
        });
      });
    },

    render: function(){
      this.$el.html(makeDataRows(
        this.model.get("cols"),
        this.model.get("ri")
      ));

      if(this.model.get("isSelected")){
        this.$el.addClass("selected");
      }else{
        this.$el.removeClass("selected");
      }

      return this;
    },

    tdToCi: function(td){
      return _.findIndex(this.$el.find("td"), function(it){
        return it === td;
      });
    }
  });

  ////////////////////////////////

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

$(function(){
  Jdbcwb.start();
});
