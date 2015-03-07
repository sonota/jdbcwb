var Editor = (function(){

  ////////////////////////////////
  // Utilities

  function strip(s){
    return s
      .replace(/^ +/, "")
      .replace(/ +$/, "")
    ;
  }

  function startsWith(str, pattern){
    return (str.indexOf(pattern) === 0);
  }

  function getBeginningOfParagraph(text, pos){
    var from;

    if(pos <= 2){
      return 0;
    }

    for(var i=pos-2; i>=0; i--){
      var temp = text.substring(i);
      if( startsWith(temp, "\n\n") ){
        from = i + 2;
        break;
      }
    }

    return from || 0;
  }

  function getEndOfParagraph(text, pos){
    var to;
    var len = text.length;

    if(pos >= len-2){
      return len;
    }

    for(var i=pos-1; i<len-2; i++){
      var temp = text.substring(i);
      if( startsWith(temp, "\n\n") ){
        to = i;
        break;
      }
    }

    return to || len;
  }


  ////////////////////////////////
  // Main


  function Editor(outer){
    this.$el = $('<textarea></textarea>');
    this.el = this.$el.get(0);
    $(outer).append(this.$el);
  }
  var __ = Editor.prototype;

  __.val = function(){
    return this.$el.val.apply(this.$el, arguments);
  };

  __.getSql = function(){
    var el = this.el;
    var val = el.value;

    var selFrom = Math.min(el.selectionStart, el.selectionEnd);
    var selTo   = Math.max(el.selectionStart, el.selectionEnd);

    var sql;

    if(selFrom === selTo){
      var from = getBeginningOfParagraph(val, selFrom);
      var to = getEndOfParagraph(val, selFrom);
      sql = val.substring(from, to);
    }else{
      sql = val.substring(selFrom, selTo);
    }
    sql = strip(sql);

    return sql;
  };

  return Editor;
})();
