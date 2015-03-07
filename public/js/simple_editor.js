var Editor = (function(){

  function Editor(outer){
    this.$el = $('<textarea></textarea>');
    $(outer).append(this.$el);
  }

  return Editor;
})();
