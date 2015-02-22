function puts(){
  console.log.apply(console, arguments);
}

$(function(){

  $(".btn_query").on("click", function(){
    var sql = $("#_editor_generic textarea").val();
    $.post("/api/query", {
      sqls: JSON.stringify([sql])
    }, function(data){
      $("#ajax_response").val(JSON.stringify(data));
    });
  });

}); 
