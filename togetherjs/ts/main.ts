const baseUrl = "../../";
let cacheBust = Date.now() + "";

/**/
//require(["require", "exports"], () => {
    //require(["../init.js"], () => {
        require(['../togetherjs'], function(){
            //main is loaded, probably don't need to do anything here..
            console.log("========== require togetherjs loaded");
        });
    //});
//});
/**/
