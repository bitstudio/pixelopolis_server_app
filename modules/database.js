/*
 * Copyright 2020 Google LLC
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var MongoClient = require('mongodb').MongoClient; 
var assert = require('assert');
var utils = require('./utils');

var database = null;

const defaultfn = ()=>{}

function Mongo() {
	this.connect = function(url) {
        MongoClient.connect(url || 'mongodb://localhost:27017',  { useNewUrlParser: true, useUnifiedTopology: true })
        .then((client) => {
            database = client.db('pixelopolis_server');
            utils.debuglog("Connected correctly to database server.");
      
        }).catch(err => {
            utils.debuglog("DB Connection Error:"+ err.message);
        });
    };

    /////////////////////////// Station

    this.addStation = function(station, fn) {
        database.collection('station').update({device_id: station.device_id}, {"$set": station}, {upsert: true}, fn);
    } 

    this.findStationById = function(station_id, fn) {
        database.collection('station').find({station_id: station_id}).toArray(fn);
    }
    
    this.getAllStation= function() {
        return new Promise(async (resolve,reject) => {
            database.collection('station').find({}).toArray((err, res)=>{
                if(err) reject(err)
                resolve(res)
            })
        })
    }

    this.findStationByDeviceId = function(device_id, fn) {
        database.collection('station').find({device_id: device_id}).toArray(fn);
    }
        
    this.updateStation = function(device_id, data, fn) {
        utils.debuglog("to db func");
        utils.debuglog(data);
        database.collection('station').update({device_id: device_id}, {"$set": data}, fn);
    }

    this.updateStationById= function(station_id, data, fn) {
        database.collection('station').update({station_id: station_id}, {"$set": data}, fn);
    }

    this.updateAliveStation = function(object, fn) {
        let update = {
            device_info: object.device_info,
            update_time: object.update_time
        };
        database.collection('station').update({device_id: object.device_id}, {"$set": update}, fn);
    }

    this.updateStationStatus = function(device_id, status, fn) {
        database.collection('station').update({device_id: device_id}, {"$set": {status: status}}, fn);
    }

    
    /////////////////////////// Car
    
    this.addCar = function(car, fn) {
        database.collection('car').update({device_id: car.device_id}, {"$set": car}, {upsert: true}, fn);
    }

    this.updateCar= function(device_id, data, fn) {
        database.collection('car').update({device_id: device_id}, {"$set": data}, fn);
    }

    this.getAllCar= function() {
        return new Promise(async (resolve,reject) => {
            database.collection('car').find({}).toArray((err, res)=>{
                if(err) reject(err)
                resolve(res)
            })
        })
    }

    this.updateCarById= function(car_id, data, fn) {
        database.collection('car').update({car_id: car_id}, {"$set": data}, fn);
    }
    
    this.findCarByCarId = function(car_id, fn) {
        database.collection('car').find({car_id: car_id}).toArray(fn);
    }

    this.findCarByDeviceId = function(device_id, fn) {
        database.collection('car').find({device_id: device_id}).toArray(fn);
    }

    this.findCarByStatus = function(status, fn) {
        database.collection('car').find({status: status}).toArray(fn);
    }

    this.updateAliveCar = function(object, fn) {
        let update = {
            device_info: object.device_info,
            update_time: object.update_time
        };
        database.collection('car').update({device_id: object.device_id}, {"$set": update}, fn);
    }

    this.updateCarStatus = function(car_id, device_id, status, fn) {
        database.collection('car').update({"$and": [{car_id: car_id}, {device_id: device_id}]}, {"$set": {status: status}}, fn);
    }
    
    ///////////////////////////// Booking Process

    this.addBookingList = function(booking_data, fn=defaultfn) {
        database.collection('booking_list').update({station_id: booking_data.station_id}, {"$set": booking_data}, {upsert: true}, fn);
    }

    this.getBooking = function(query, fn) {
        database.collection('booking_list').find(query).toArray(fn);
    }
    
    this.queryBookingByStationDeviceId = function(device_id, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            database.collection('booking_list').find({station_device_id: device_id}).toArray((err, res)=>{
                fn(err, res)
                if(err) reject(err)
                resolve(res[0])
            });
        })
    }

    this.queryBookingByCarDeviceId = function(device_id, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            database.collection('booking_list').find({car_device_id: device_id}).toArray((err, res)=>{
                fn(err, res)
                if(err) reject(err)
                resolve(res[0])
            });
        })
    }

    this.updateBookingList = function(station_id, data, fn) {
        database.collection('booking_list').update({station_id: station_id}, {"$set": data}, {upsert: true}, fn);
    }

    this.updateBookingByQuery = function(query, data, fn=defaultfn, upsert=true) {
        return new Promise((resolve,reject)=>{
            database.collection('booking_list').update(query, {"$set": data}, {upsert: upsert}, (err, res)=>{
                fn(err, res)
                if(err) reject(err)
                resolve()
            });
        })
    }


    this.uploadPhotoToBookedList = function(station_id, photo_url, fn) {
        database.collection('booking_list').update({station_id: station_id}, {"$set": {"photo_url": photo_url}}, fn);
    };

    this.removeBookedList =function(query, fn) {
        database.collection('booking_list').remove(query, fn);
    }

    ///////////////////////////// Booking History
    this.addBookingHistory = function(bookked_data, fn) {
        database.collection('booking_history').insert(bookked_data, fn);
    }




    // =========================================================================
    // Tung: Visualization
    // =========================================================================
    
    // -------------------------------------------------------------------------
    // Car Config
    // -------------------------------------------------------------------------

    this.clearCarFromNode = function(car_id, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            let nodes = database.collection('node_list').find({}).toArray()

            Promise.all([nodes]).then(function (results) {
                let newNodes = results[0]
                nodeBulkUpdate = []
                for(let i = 0; i < newNodes.length; i++){
                    nodeBulkUpdate.push({ updateOne: { filter: {node_id: newNodes[i]['node_id']}, update: { $pull: { 'car_priority_queue': { car_id: car_id } } } } })
                }
                database.collection('node_list').bulkWrite(nodeBulkUpdate,{},(err)=>{
                    if(err) utils.debuglog(err)
                    utils.debuglog('CAR: '+car_id+' : Clear from Node Finish')
                    fn(null, {})
                    resolve()
                })
            }).catch(function (err) {
                fn(err, {success: false})
                reject(err)
            });
        })
    }

    this.clearCarFromPath = function(car_id, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            let paths = database.collection('path_list').find({}).toArray()

            Promise.all([paths]).then(function (results) {
                let newPaths = results[0]
                pathBulkUpdate = []
                for(let i = 0; i < newPaths.length; i++){
                    pathBulkUpdate.push({ updateOne: { filter: {path_id: newPaths[i]['path_id']}, update: { $pull: { 'cars': car_id } } } })
                }
                database.collection('path_list').bulkWrite(pathBulkUpdate,{},(err)=>{
                    if(err) utils.debuglog(err)
                    utils.debuglog('CAR: '+car_id+' : Clear from Path Finish')
                    fn(null, {})
                    resolve()
                })
            }).catch(function (err) {
                fn(err, {success: false})
                reject(err)
            });
        })
    }

    // -------------------------------------------------------------------------
    // Map Config
    // -------------------------------------------------------------------------
    ////Remove Map Config
    this.clearMapConfig = function() {
        return new Promise((resolve,reject)=>{
            database.collection('map_config').remove({},(err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }

    ////Add Map config
    this.setMapConfig = function(config) {
        return new Promise((resolve,reject)=>{
            database.collection('map_config').insertOne(config,(err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }

        // -------------------------------------------------------------------------
    // Main Config
    // -------------------------------------------------------------------------
    ////Remove Config
    this.clearConfig = function() {
        return new Promise((resolve,reject)=>{
            database.collection('config').remove({},(err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }

    ////Add config
    this.setConfig = function(config) {
        return new Promise((resolve,reject)=>{
            database.collection('config').insertOne(config,(err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }

    ////Get Node List
    this.getConfig = function() {
        return new Promise(async (resolve,reject) => {
            database.collection('config').find({}).toArray((err, res)=>{
                if(err) reject(err)
                resolve(res)
            })
        })
    }

    // -------------------------------------------------------------------------
    // Node List
    // -------------------------------------------------------------------------

    ////Add Node List
    this.setNodeList = function(nodeData) {
        return new Promise((resolve,reject)=>{
            database.collection('node_list').insertMany(nodeData,(err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }

    ////Update Node
    this.updateNodeByQuery = function(query, data, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            database.collection('node_list').update(query, {"$set": data}, {upsert: true}, (err, res)=>{
                fn(err, res)
                if(err) reject(err)
                utils.debuglog('Finish update node')
                resolve()
            });
        })
    }

    this.updateManyNode = async function(nodes, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            let nodeBulkUpdate = []
            for(let i = 0; i < nodes.length; i++){
                let nodeNum = Number(nodes[i]['node_id'])
                let node =  nodes[i]
                nodeBulkUpdate.push({ 
                    updateOne: { 
                        filter: { node_id: nodeNum }, 
                        update: { "$set": node }, upsert: true } 
                    })
            }
            database.collection('node_list').bulkWrite(nodeBulkUpdate,{},(err)=>{
                if(err) {
                    utils.debuglog(err)
                    reject(err)
                }
                utils.debuglog('Update Node Finish')
                fn()
                resolve()
            })
        })
    }

    ////Remove Node List
    this.clearNodeList = function() {
        return new Promise((resolve,reject)=>{
            database.collection('node_list').remove({},(err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }

    ////Get Node List
    this.getNodeList = function() {
        return new Promise(async (resolve,reject) => {
            database.collection('node_list').find({}).toArray((err, res)=>{
                if(err) reject(err)
                resolve(res)
            })
        })
    }

    this.getNodeByNodeId = function(node_id) {
        return new Promise(async (resolve,reject) => {
            database.collection('node_list').find({node_id: node_id}).toArray((err, res)=>{
                if(err) reject(err)
                resolve(res[0])
            })
        })
    }

    // =========================================================================
    // Path List
    // =========================================================================

    ////Update Path
    this.updatePathByQuery = function(query, data, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            database.collection('path_list').update(query, {"$set": data}, {upsert: true}, (err, res)=>{
                fn(err, res)
                if(err) reject(err)
                utils.debuglog('Finish update path')
                resolve()
            });
        })
    }

    this.updateManyPath = async function(paths, fn=defaultfn) {
        return new Promise((resolve,reject)=>{
            let pathBulkUpdate = []
            for(let i = 0; i < paths.length; i++){
                let pathNum = Number(paths[i]['path_id'])
                let path =  paths[i]
                pathBulkUpdate.push({ 
                    updateOne: { 
                        filter: { path_id: pathNum }, 
                        update: { "$set": path }, upsert: true } 
                    })
            }
            database.collection('path_list').bulkWrite(pathBulkUpdate,{},(err)=>{
                if(err) {
                    utils.debuglog(err)
                    reject(err)
                }
                utils.debuglog('Update Path Finish')
                fn()
                resolve()
            })
        })
    }

    ////Get Path List
    this.getPathList = function() {
        return new Promise(async (resolve,reject) => {
            database.collection('path_list').find({}).toArray((err, res)=>{
                if(err) reject(err)
                resolve(res)
            })
        })
    }

    this.getPathByPathId = function(path_id) {
        return new Promise(async (resolve,reject) => {
            database.collection('path_list').find({path_id: path_id}).toArray((err, res)=>{
                if(err) reject(err)
                resolve(res[0])
            })
        })
    }

    // =========================================================================
    // Booking
    // =========================================================================

    // =========================================================================
    // Station
    // =========================================================================

    ////Add Stations
    this.setStations = function(stations) {
        return new Promise((resolve,reject)=>{
            database.collection('station').insertMany(stations, (err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }
    
    ////Remove Stations
    this.clearStations = function() {
        return new Promise((resolve,reject)=>{
            database.collection('station').remove({},(err, res)=>{
                if(err) reject(err)
                else resolve()
            })
        })
    }

    // =========================================================================
    // Misc
    // =========================================================================
    
    this.getAll = async function(fn) {
        let bookingList = database.collection('booking_list').find({}).toArray()
        let cars = database.collection('car').find({}).toArray()
        let stations = database.collection('station').find({}).toArray()
        let nodes = database.collection('node_list').find({}).toArray()
        let paths = database.collection('path_list').find({}).toArray()
        let mapConfig = database.collection('map_config').find({}).toArray()
        let config = database.collection('config').find({}).toArray()
        Promise.all([bookingList, cars, stations, nodes, paths, mapConfig, config]).then(function (results) {
            let objResult = {
                "booking_list": results[0],
                "car": results[1],
                "station": results[2],
                "node_list": results[3],
                "path_list": results[4],
                "map_config": results[5],
                "config": results[6]
            }
            fn(null, objResult)
        }).catch(function (err) {
            fn(err, {success: false})
        });
    }

    this.fetchBooking = async function(fn=defaultfn) {
        let bookingList = database.collection('booking_list').find({}).toArray()
        Promise.all([bookingList]).then(function (results) {
            let objResult = {
                "booking_list": results[0]
            }
            fn(null, objResult)
        }).catch(function (err) {
            fn(err, {success: false})
        });
    }

    this.clearCar = async function(data, fn=defaultfn) {
        let car_device_id = data.car_device_id
        let station_device_id = data.station_device_id
        let cars = database.collection('car').remove({device_id: car_device_id})
        let stations = database.collection('station').remove({device_id: station_device_id})
        let booking = database.collection('booking_list').find({car_device_id: car_device_id}).toArray()
        let nodes = database.collection('node_list').find({}).toArray()
        let paths = database.collection('path_list').find({}).toArray()
        Promise.all([booking, cars, stations, nodes, paths]).then(function (results) {
            let newNodes = results[3]
            let newPaths = results[4]
            let newBooking = results[0]
            let car_id =  newBooking.car_device_id
            let station_id =  newBooking.station_device_id
            let nodeBulkUpdate = []
            let pathBulkUpdate = []
            utils.debuglog(newBooking);
            for(let i = 0; i < newNodes.length; i++){
                let car_priority_queue = newNodes[i]['car_priority_queue']
                utils.debuglog(car_priority_queue)
                let carIndex = car_priority_queue.findIndex((o)=>o.car_id === car_id)
                utils.debuglog("#Remove Car Index: "+carIndex)
                car_priority_queue.splice(carIndex, 1)
                nodeBulkUpdate.push({ updateOne: { filter: {node_id: newNodes[i]['node_id']}, update: {$set: {car_priority_queue: car_priority_queue}}, upsert:true } })
            }

            for(let i = 0; i < newPaths.length; i++){
                let cars = newPaths[i]['cars']
                let carIndex = cars.findIndex((o)=>o === car_id)
                cars.splice(carIndex, 1)

                pathBulkUpdate.push({ updateOne: { filter: {path_id: newPaths[i]['path_id']}, update: {$set: {cars:cars}}, upsert:true } })
            }
            database.collection('booking_list').remove({car_device_id: car_device_id, station_device_id: station_device_id})
            database.collection('node_list').bulkWrite(nodeBulkUpdate,{},()=>utils.debuglog('Update Node Finish'))
            database.collection('path_list').bulkWrite(pathBulkUpdate,{},()=>utils.debuglog('Update Path Finish'))
            fn(null, {success:true})
        }).catch(function (err) {
            fn(err, {success: false})
        });
    }

    this.clearCarAndStationByCarId = async function(id, fn=defaultfn) {
        let station_id = id
        let car_id = id
        let cars = database.collection('car').remove({car_id: car_id})
        let stations = database.collection('station').remove({station_id: station_id })
        let booking = database.collection('booking_list').find({car_id: car_id}).toArray()
        let nodes = database.collection('node_list').find({}).toArray()
        let paths = database.collection('path_list').find({}).toArray()
        Promise.all([booking, cars, stations, nodes, paths]).then(function (results) {
            let newNodes = results[3]
            let newPaths = results[4]
            let newBooking = results[0]?results[0][0]:null
            let car_device_id =  newBooking.car_device_id
            let nodeBulkUpdate = []
            let pathBulkUpdate = []
            for(let i = 0; i < newNodes.length; i++){
                let car_priority_queue = newNodes[i]['car_priority_queue']
                let carIndex = car_priority_queue.findIndex((o)=>o.car_id === car_id)
                car_priority_queue.splice(carIndex, 1)
                nodeBulkUpdate.push({ updateOne: { filter: {node_id: newNodes[i]['node_id']}, update: {$set: {car_priority_queue: car_priority_queue}}, upsert:true } })
            }

            for(let i = 0; i < newPaths.length; i++){
                let cars = newPaths[i]['cars']
                let carIndex = cars.findIndex((o)=>o === car_id)
                cars.splice(carIndex, 1)

                pathBulkUpdate.push({ updateOne: { filter: {path_id: newPaths[i]['path_id']}, update: {$set: {cars:cars}}, upsert:true } })
            }
            if(newBooking) database.collection('booking_list').remove({car_device_id: car_device_id})
            database.collection('node_list').bulkWrite(nodeBulkUpdate,{},()=>utils.debuglog('Update Node Finish'))
            database.collection('path_list').bulkWrite(pathBulkUpdate,{},()=>utils.debuglog('Update Path Finish'))
            fn(null, {success:true})
        }).catch(function (err) {
            fn(err, {success: false})
        });
    }

    this.clearAll = async function(fn=defaultfn) {
        let bookingList = database.collection('booking_list').remove({})
        let cars = database.collection('car').remove({})
        let stations = database.collection('station').remove({})
        let nodes = database.collection('node_list').find({}).toArray()
        let paths = database.collection('path_list').find({}).toArray()
        Promise.all([bookingList, cars, stations, nodes, paths]).then(function (results) {
            let newNodes = results[3]
            let newPaths = results[4]
            let nodeBulkUpdate = []
            let pathBulkUpdate = []
            for(let i = 0; i < newNodes.length; i++){
                nodeBulkUpdate.push({ updateOne: { filter: {node_id: newNodes[i]['node_id']}, update: {$set: {car_priority_queue:[]}}, upsert:true } })
            }

            for(let i = 0; i < newPaths.length; i++){
                pathBulkUpdate.push({ updateOne: { filter: {path_id: newPaths[i]['path_id']}, update: {$set: {cars:[]}}, upsert:true } })
            }
            database.collection('node_list').bulkWrite(nodeBulkUpdate,{},()=>utils.debuglog('Update Node Finish'))
            database.collection('path_list').bulkWrite(pathBulkUpdate,{},()=>utils.debuglog('Update Path Finish'))
            fn(null, {success:true})
        }).catch(function (err) {
            fn(err, {success: false})
        });
    }
};

module.exports = new Mongo();