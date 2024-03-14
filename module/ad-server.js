/**
@author jhbaek
@version 1.0.0
@file AD서버를 조회해 칵테일 유저를 생성 및 수정하는 모듈입니다.
*/ 

/** @global */
/** @description request 모듈 가져오기 */
const request = require('request');

/** @global */
/** @description express framework 가져오기 */
const express = require('express');
const app = express();

/* 배치 설정 하루에 한 번 실행  -> 크론잡에 올리는 것으로 변경 */
// const schedule = require('node-schedule');
// const regularExec = schedule.scheduleJob('* * */24 * * *', () => {
    runModule();
// })

/* 날짜 가져오기 */
let date = new Date();
/** @global */
/** @description 로그의 시간을 입력하기 위한 변수 */
let now = date.getFullYear()+"."+(date.getMonth()+1)+"."+date.getDate()+" "+date.getHours()+":"+date.getMinutes()+":"+date.getSeconds()+" ";

/* 칵테일 클러스터 조회 */
/** @description getAllCluster 칵테일 서버의 모든 클러스터 데이터를 가져온다.
    @param {List<object>} users AD서버의 유저 데이터들 
    @param {List} envDepart 환경변수에 설정된 허용 부서명의 리스트  */
function getAllCluster(users,envDepart) {
    request({
        url: process.env.COCKTAIL+'api/cluster/v2/conditions',
        method: 'GET'
    },function(err,response,body){
        if (err != null) {
            console.log("[ getAllCluster ] "+ now +"error :::"+err);
        }
        let data = JSON.parse(body);
    //    console.log("[ getAllCluster ] "+ now +" 결과 코드 :::",data.code);
        let resultList = [];
        let result;

        for (let i=0 ; i <= data.result.length-1; i++) {
            if(data.result[i].clusterState == 'RUNNING') {
                result = data.result[i].account.accountSeq;
                // console.log("result 가공",result);
                for (let j=0; j <= resultList.length ; j++) {
                    if (resultList[j] == data.result[i].account.accountSeq ) {
                        result = null;
                    } 
                }
                if (result != null) {
                    console.log("[ getAllCluster ] "+ now +" 어카운트 시퀀스 ::: ",result);
                    resultList.push(result);
                    getUserList(users,result,envDepart);
                }
            }
        }
    })
}

/* ad정보를 가져왔고, 칵테일 정보를 조회해서 정보 가공을 해야하는 중요한 함수*/
/** @description getUserList 칵테일 유저를 가져와서 정보 가공을 한다.
    @param {List<object>} adUsers AD서버의 유저 데이터들 
    @param {number} accountSeq 해당 유저가 속한 플랫폼의 account Sequence  
    @param {List} envDepart 환경변수에 설정된 허용 부서명의 리스트  */
async function getUserList(adUsers,accountSeq,envDepart) {
    await request({
        url: process.env.COCKTAIL+'api/account/'+accountSeq+'/users',
        method: 'GET',
        headers: {"user-id":1,"user-role":"ADMIN"}

    }, function(err,response,body){
        if (err != null) {
            console.log("[ getUserList ] "+ now +"error :::"+err);
        }
    
        let data = JSON.parse(response.body);
        let cocktailUser= [];
        
    //    console.log("[ getUserList ] "+ now +"결과 코드 :::"+data.username);

        for(let i=0; i <= adUsers.length-1 ; i++) {
            let department = adUsers[i].attributes.LDAP_ENTRY_DN.toString();
            let departIndex = department.indexOf('OU')+2;
            department = department.substring(departIndex+1,department.length);
            let departIndex2 = department.indexOf(",OU");
            department = department.substring(0,departIndex2);

            cocktailUser.push(adUsers[i]);

            for (let j=0; j <= data.result.length-1 ; j ++) {
                if (adUsers[i].username == data.result[j].userId) { // 기존에 있는 유저라면...
                    if(cocktailUser.length != 0) {
                        cocktailUser.length = cocktailUser.length-1;// 같은 값이 있으면 초기화 시킨다.
                    }
                    if(department != data.result[j].userDepartment && department ) {// 부서명이 변경됐을 경우 업데이트.
                        console.log("[ getUserList ] "+ now +"수정 할 유저 :::"+data.result[j].username);
                        return modCocktailUser(data.result[j].userSeq, accountSeq, department, data.result[j]);
                    }   
                } 
            } 
        }
        console.log("[ getUserList ] "+ now +"추가 유저 리스트 :::",cocktailUser);
        if (cocktailUser != null) {
            for (let i=0; i <= cocktailUser.length-1 ; i ++) {

                let data = cocktailUser[i].attributes.LDAP_ENTRY_DN.toString();
                let departIndex = data.indexOf('OU')+2;
                data = data.substring(departIndex+1,data.length);
                let departIndex2 = data.indexOf(",OU");
                let depart = data.substring(0,departIndex2);

                //  console.log("[ getUserList ] depart ::: ",depart);
                //  console.log("[ getUserList ] envDepart :::",envDepart);
                for (let j=0; j <= envDepart.length-1 ; j++) {
                    if (depart == envDepart[j]) {
                        // console.log("[ getUserList ] 옳은 부서명 :::",depart);
                        console.log("[ getUserList ] "+ now +"추가 유저 :::",cocktailUser[i].username);
                        addCocktailUser(cocktailUser[i],accountSeq,depart);
                    } 
                }

            }
        } 
    })
}

/* 칵테일 유저 수정 */
/** @description modCocktailUser AD서버의 데이터가 변경된 유저의 부서명을 변경하는 함수.
    @param {number} userSeq 해당 유저의 데이터  
    @param {number} accountSeq 해당 유저가 속한 플랫폼의 account Sequence  
    @param {String} userDepartment 해당 유저의 부서명  
    @param {object} user 해당 유저의 데이터 */
function modCocktailUser(userSeq,accountSeq,userDepartment,user) {
    console.log("mod1 ",JSON.stringify(user));
    request({
         url: process.env.COCKTAIL+'api/account/'+accountSeq+'/user/'+userSeq,
         method: 'PUT',
         headers: {'user-id':1,"user-role":"ADMIN"},
         body: {
             userDepartment: userDepartment,
             inactiveYn: "Y",
             initPasswordYn: "",
             kubeconfigRoles: [],
             roles: ["DEVOPS"],
             shellRoles: [],
             userId: user.username,
             userName: user.lastName+user.firstName,
         },
         json: true
     }, function(err,response,body) {
         if (err) {
             console.log("[ modCocktailUser ] "+ now +"error :::",err);
         }     
         let data = body;
    //     console.log("[ modCocktailUser ] "+ now +"결과 코드 :::", data.code); 
         if (data.code ==200) {
            inactiveUser(userSeq,accountSeq);
         }
     })
}

/* 칵테일 유저 추가 */
/** @class */
/** @description addCocktailUser 확인된 ad서버의 유저 데이터로 칵테일 유저 생성을 한다.
    @param {object} checkedUser 해당 유저의 데이터  
    @param {number} accountSeq 해당 유저가 속한 플랫폼의 account Sequence  
    @param {String} depart 해당 유저의 부서명  */
function addCocktailUser(checkedUser,accountSeq,depart) {
    request({
        url: process.env.COCKTAIL+'api/account/'+accountSeq+'/user',
        method: 'POST',
        headers: {'user-id':1,"user-role":"ADMIN"},
        body: {
            userId: checkedUser.username,
            userName: checkedUser.lastName+checkedUser.firstName,
            roles: ["DEVOPS"],
            userDepartment: depart
        },
        json: true
    }, function(err,response,body) {
        if (err) {
            console.log("[ addCocktailUser ] "+ now +"error :::",err);
        }     
    //    console.log("[ addCocktailUser ] "+ now +"결과 코드 :::", response.statusCode);
        inactiveUser(body.result.userSeq,accountSeq);
    })
}

/* 칵테일 유저 비활성화 */
/** @class */
/** @description inactiveUser 넘어온 user Sequence로 해당 계정을 비활성화 한다. */
/** @param {number} userSeq 해당 유저의 user Sequence  
    @param {number} accountSeq 해당 유저가 속한 플랫폼의 account Sequence  */
async function inactiveUser(userSeq,accountSeq) {
    console.log("[ inactiveUser ] inactive ::: "+"userSeq :"+ userSeq+"  , accountSeq :"+accountSeq);
    await request({
        url: process.env.COCKTAIL+'api/account/'+accountSeq+'/user/'+userSeq+"/inactive",
        method: 'PUT',
        headers: {'user-id':3,"user-role":"SYSTEM"},
        body: {
            userSeq: parseInt(userSeq),
            inactiveYn: "Y"
        },
        json: true
    }, function(err,response,body){
        if (err) {
            console.log("[ inactiveUser ] "+ now +"error :::",err);
        }
    //    console.log("[ inactiveUser ] "+ now +"결과 코드 :::",body.code);   // 재대로 나옴
    })
}

/* ad서버 데이터 가져오기 */
/** @class */
/** @description getAdServer AD서버의 데이터를 전부 가져와서 getAllCluster로 넘긴다. */
async function getAdServer() {
    await request({
        url: process.env.ADSERVER,
        method: 'GET'
    },function(err,response,body){
        let count = 0;
        let users =[];
        if (err != null) {
            console.log("[ getAdServer ] "+ now +"error :::"+ err);
        }
        let data = JSON.parse(body);
        let size = data.length;
        for (let i=0 ; i <= size-1 ; i++) {
            if (data[i].attributes) {
                let originData = data[i].attributes.LDAP_ENTRY_DN.toString();
                if (originData) {
                    users[count] = data[i];
                    count ++;
                }  
            }
        }
        console.log("[ getAdServer ] "+ now +"AD 유저 조회 결과 :::"+ users);
        return getAllCluster(users,getDepartList());
    })
}

/* 환경변수에 설정되어있는 부서명 배열로 가공 */
/** @class */
/** @description 환경변수에 설정된 부서명을 가공한다. */
function getDepartList() {
    let envDepart = process.env.DEPART; 
    let index1 = 0;
    let flag = true;
    let departProcess = [];

    while (flag) {
        index1 = envDepart.indexOf(',');
        if (envDepart.length != 0 && index1 == -1) {
            flag = false;
            departProcess.push(envDepart);
        } else {
            departProcess.push(envDepart.substring(0,index1));
            envDepart = envDepart.substring(index1+1,envDepart.length);
        }
        if (envDepart.length == 0) {
            flag = false;
        }
    }
    return departProcess;
}

/* 실행 함수 */
/** @class */
/** @description 모듈을 실행 시키는 함수이다. <br> getAdServer함수를 실행시킨다.*/
function runModule() {
    getAdServer();
} 



