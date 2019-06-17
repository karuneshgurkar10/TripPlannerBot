'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const Datastore = require('@google-cloud/datastore');
const firebase = require('firebase-admin');

// Web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB-h5ZEYWMsXNCSbbhmNxPLkR_A5RCKUao",
    authDomain: "tripplanner-vjygur.firebaseapp.com",
    databaseURL: "https://tripplanner-vjygur.firebaseio.com",
    projectId: "tripplanner-vjygur",
    storageBucket: "tripplanner-vjygur.appspot.com",
    messagingSenderId: "1066988460863",
    appId: "1:1066988460863:web:07c7a168a45ed083"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
db.settings({ timestampInSnapshots:true });

const projectId = 'tripplanner-vjygur';
// Instantiates a client
const datastore = new Datastore({
  projectId: projectId
});
// To get the date and time in local format
const timeZone = 'Asia/Calcutta';
 
// Define intents
const BOOK_FLIGHT_INTENT = "Flights - yes";
const CONFIRM_FLIGHT_BOOKING_INTENT = "Flights";
const BOOK_CAR_INTENT = "Cars";
const BOOK_ROOM_FOLLWEDBY_FLIGHT_INTENT = "Flights - followupBookRooms";
const BOOK_ROOM_INTENT = "Rooms";
const COLLECT_CONTACT_NO_FOR_INFO_INTENT  = "BookingInfo - collectPhoneNumber";
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  
   // Function to book a flight and this will ask for confirmation
   const confirmBooking = (agent) => {

    // Get all the user inputs
    var userData = getInputsFromUser(agent);
    // Convert the Date object into human-readable string.
    const departureDateString = getDateInHumanReadableForm(userData.date.toString());

    agent.add(`Can i go ahead and book your flight on ${departureDateString} from ${userData.source} to ${userData.destination}?`);
  };
    
    // Function to book a flight 
   	const bookFlight = (agent) => {    
    // Get the context 'Flights-followup'
    const context = getContext(agent,'flights-followup');

    // Get all the user inputs
    var userData = getInputsFromUser(context);
      
    // Convert the Date object into human-readable string.
    const departureDateString = getDateInHumanReadableForm(userData.date.toString());

    // The kind for the new entity
    const kind = 'bookFlight';
    saveBookingInfo(kind,userData);
    agent.add(`Done! I have booked your flight on ${departureDateString} from ${userData.source} to ${userData.destination}`);
  };
  
  // Function to book a car 
  const bookCar = (agent) => {
       // Get the context 'Flights-followup'
       const context = getContext(agent,'flights-followup');
       // Get all the user inputs
       var userData = getInputsFromUser((context) ? context : agent);
   
    // Convert the Date object into human-readable string.
    const pickUpDateString = getDateInHumanReadableForm(userData.date);
   
       // The kind for the new entity
       const kind = 'bookCar';
       saveBookingInfo(kind,userData);
       agent.add(`I have  booked a ${userData.type} for you on ${pickUpDateString} at ${getTimeInHumanReadableForm(userData.time)}`);
  };
  
  // Function to book a room 
  const bookRoom = (agent) => {
    // Get the context 'Flights-followup'
    const context = getContext(agent,'flights-followup');
    // Get all the user inputs
    var userData = getInputsFromUser((context) ? context : agent);

    // Convert the Date object into human-readable string.
    const pickUpDateString = getDateInHumanReadableForm(userData.date);

    // The kind for the new entity
    const kind = 'bookRoom';
    saveBookingInfo(kind,userData);
    agent.add(`Reserved a room for you in ${userData.destination} on ${pickUpDateString}`);
  };
  
  // Function to get the booking information
  const getBookingInfo = (agent) => {
    const infoType = agent.parameters.info_type;
    const phoneNumber = agent.parameters['phone-number'];
    switch(infoType) {
        case 'car':
            return db.collection('bookCar').where('phoneNumber', '==', phoneNumber)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                  agent.add('No cabs are booked for you.Please go ahead and book.');
                  return;
                }  
                snapshot.forEach(doc => {
                agent.add(`Your cab is booked on ${getDateInHumanReadableForm(doc.data().date)}`);
                });
              })
              .catch(err => {
                console.log('Error getting documents', err);
              });
        case 'flight':
            return db.collection('bookFlight').where('phoneNumber', '==', phoneNumber)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                agent.add('No flights are booked for you.Please go ahead and book.');
                return;
                }  
                snapshot.forEach(doc => {     
                agent.add(`Your flight is scheduled on ${getDateInHumanReadableForm(doc.data().date)} from ${doc.data().source} to ${doc.data().destination}`) ;
                });
            })
            .catch(err => {
                console.log('Error getting documents', err);
            });
        case 'room':
            return db.collection('bookRoom').where('phoneNumber', '==', phoneNumber)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                agent.add('No rooms are booked for you.Please go ahead and book.');
                return;
                }  
                snapshot.forEach(doc => {
                agent.add(`Your room is booked on ${getDateInHumanReadableForm(doc.data().date)}`) ;
                });
            })
            .catch(err => {
                console.log('Error getting documents', err);
            });
        default:
            return db.getCollections().then(collections => {
                let responseString;                
                for (let collection of collections) {
                     db.collection(collection.id).where('phoneNumber', '==', phoneNumber)
                    .get()
                    .then(snapshot => {
                        if (!snapshot.empty) {
                                snapshot.forEach(doc => {
                                     responseString += `Your ${collection.id.substring(4)} is booked on ${getDateInHumanReadableForm(doc.data().date)}.\n\n`;
                                });
                            }  
                    })
                    .catch(err => {
                        console.log('Error getting documents', err);
                    });
                }
            });
    }
  };

  let intentMap = new Map();
  intentMap.set(CONFIRM_FLIGHT_BOOKING_INTENT, confirmBooking);
  intentMap.set(BOOK_FLIGHT_INTENT, bookFlight);
  intentMap.set(BOOK_CAR_INTENT, bookCar);
  intentMap.set(BOOK_ROOM_FOLLWEDBY_FLIGHT_INTENT, bookRoom);
  intentMap.set(BOOK_ROOM_INTENT, bookRoom);
  intentMap.set(COLLECT_CONTACT_NO_FOR_INFO_INTENT,getBookingInfo);
  agent.handleRequest(intentMap);
});

// A helper function that receives Dialogflow's 'date' and 'time' parameters and creates a Date instance.
const convertTimestampToDate = (date) => {
    // Parse the date, time, and time zone offset values from the input parameters and create a new Date object
    return new Date(Date.parse(date.split('T')[0]));
};

// A helper function that converts the Date instance 'dateObj' into a string that represents this date in English.
const getLocaleDateString = (dateObj) => {
    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: timeZone });
};

//A helper function to store the booking information
const saveBookingInfo = (kind, data) => {
    const taskKey = datastore.key(kind);
    // Prepares the new entity
    const task = {
      key: taskKey,
      data: data
    };
    datastore.save(task)
    .then(() => {
        console.log(`Success`);
    })
    .catch((err) => {
        console.error('ERROR:', err);
    });
};

//A helper function to build the parameters
const getInputsFromUser = (agentORContext) => {
      return  {
         name: agentORContext.parameters.name,
         phoneNumber: agentORContext.parameters.phoneNumber,
         date: agentORContext.parameters.date,
         source: agentORContext.parameters['geo-city'] || null,
         destination: agentORContext.parameters['geo-city1'] || agentORContext.parameters['geo-city'],
         type: agentORContext.parameters.flight_type || agentORContext.parameters.room_type || agentORContext.parameters.car_type,
         time: agentORContext.parameters.time
     };
};

// A helper function to return the context
const getContext = (agent,outputContext) => {
    return agent.context.get(outputContext);
};

// A helper function to return the date in human readable form
const getDateInHumanReadableForm = (date) => {
    // This variable needs to hold an instance of Date object that specifies the date of the departure of the flight.
    const dateObject = convertTimestampToDate(date);
    // Convert the Date object into human-readable string.
    return getLocaleDateString(dateObject);
};

// A helper function to return the time in human readable form
const getTimeInHumanReadableForm = (time) => {
    const timeObject  = new Date(Date.parse(time));
    // Convert the Date object into human-readable string.
    return timeObject.toLocaleTimeString('en-IN',{timeZone:timeZone});
};