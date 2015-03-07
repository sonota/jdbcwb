var Editor = (function(){

  function Editor(outer){
    this.$el = $('<textarea></textarea>');
    this.el = this.$el.get(0);
    $(outer).append(this.$el);
  }
  var __ = Editor.prototype;

  __.val = function(){
    return this.$el.val.apply(this.$el, arguments);
  };

  return Editor;
})();
