
interface OPENAQarrMeasurements {
  parameter:"pm25"|"pm10"|"so2"|"co"|"o3"|"no2"
  value:number,
  lastUpdated:string,
  unit:string,
  sourceName:string
}

interface OPENAQobjMeasurements {
  value:number,
  lastUpdated:string,
  unit:string,
  sourceName:string,
  old?:OPENAQobjMeasurements[]
}

interface OPENAQresult {
  location:string,
  city:string,
  country:string,
}


interface OPENAQresultOLD extends OPENAQresult {
  measurements:OPENAQarrMeasurements[]
}
interface OPENAQresultNEW extends OPENAQresult {
  measurements:{[type:string]:OPENAQobjMeasurements}
}



interface OPENAQresponse {
  meta:{
    name:'openaq-api',
    license:'CC BY 4.0',
    website:'https://docs.openaq.org/',
    page:number,
    limit:number,
    found:number
  },

}
interface OPENAQresponseNEW extends OPENAQresponse {
  results: OPENAQresultNEW[]
}

interface OPENAQresponseOLD extends OPENAQresponse {
  results: OPENAQresultOLD[]
}

'use strict';

// [START app]
const express = require('express');


const app = express()

var RTM = require('satori-rtm-sdk');
var endpoint = "wss://open-data.api.satori.com";
var appKey = "CAAA7E7fb0B1cCdbA01B2442E7C999a8";
var roleSecretKey = "xxxxxxxxxxxxxxxxxxxxxxxxxx";
var channel = 'openaq';

var https = require('https');

var rtm:any;






var prev:string[] = [];
function OPEAQcall(){

  https.get('https://api.openaq.org/v1/latest?limit=10000', function(res:any) {
    res.setEncoding('utf8')
    var body:string[] = [];
    res.on('data', function(chunk:string) {
      body.push(chunk);
    });
    res.on('end', function() {
      var json:OPENAQresponseOLD = JSON.parse(body.join(''))
      var tmp = json.results.map((i)=>{
        var s = JSON.stringify(i)

        if (prev && prev.length && prev.indexOf(s) === -1) {
          var out:OPENAQresultNEW = JSON.parse(s);
          var tmp = i.measurements;
          out.measurements = {};
          tmp.forEach(m=>{
            if (!out.measurements[m.parameter]) out.measurements[m.parameter] = {
              value:m.value,
              lastUpdated:m.lastUpdated,
              unit:m.unit,
              sourceName:m.sourceName
            }
            else {
              if (!out.measurements[m.parameter].old) out.measurements[m.parameter].old = []
              if (new Date(m.lastUpdated) > new Date(out.measurements[m.parameter].lastUpdated)) {
                out.measurements[m.parameter].old.push({
                  value:out.measurements[m.parameter].value,
                  lastUpdated:out.measurements[m.parameter].lastUpdated,
                  unit:out.measurements[m.parameter].unit,
                  sourceName:out.measurements[m.parameter].sourceName
                })
                out.measurements[m.parameter].value = m.value
                out.measurements[m.parameter].lastUpdated = m.lastUpdated
                out.measurements[m.parameter].unit = m.unit
                out.measurements[m.parameter].sourceName = m.sourceName
              }
              else {
                out.measurements[m.parameter].old.push({
                  value:m.value,
                  lastUpdated:m.lastUpdated,
                  unit:m.unit,
                  sourceName:m.sourceName
                })
              }
            }
          })
          rtm.publish(channel, out, function (pdu:any) {

            //console.log(JSON.stringify(pdu))
            if (!pdu.action.endsWith('/ok')) {
              console.log('something went wrong');
            }
          });
        }
        return s;
      })
      prev = tmp;
    });
  });
}


var role = "openaq";

var roleSecretProvider = RTM.roleSecretAuthProvider(role, roleSecretKey);
var rtm = new RTM(endpoint, appKey, {
  authProvider: roleSecretProvider,
});
var interval:NodeJS.Timer|null = null;
var subscription = rtm.subscribe(channel, RTM.SubscriptionMode.SIMPLE);
subscription.on("enter-subscribed", function() {

  console.log("Connected to RTM!");
  if (!interval) interval = setInterval(OPEAQcall,1000*30)
});
subscription.on("error", function(error:any) {
  console.log("Error connecting to RTM: " + error.message);
  rtm.stop();
});
rtm.start();



// [END app]
