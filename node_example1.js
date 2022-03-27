console.log("initial node!");   // node node_example1.js

function add(a, b, callback) {  // Js콜백 함수 샘플
    var result = a + b;
    callback(result);
}

add(10, 10, function(result) {
    console.log("파라미터로 전달 된 콜백 함수 호출");
    console.log("결과 : "+result);
})

