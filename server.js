// Reference the packages we require so that we can use them in creating the bot
var restify = require('restify');
var builder = require('botbuilder');
var rp = require('request-promise');

var BINGSEARCHKEY = '4b0ad13a83c94bad9554a69c573b7ec9';

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
// Listen for any activity on port 3978 of our local server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID || 'fd08823c-1028-49c6-854b-9ef402ece2e9',
    appPassword: process.env.MICROSOFT_APP_PASSWORD || 'BUQJnZiohsqHzoq3MnuvgzU'
});



var bot = new builder.UniversalBot(connector);
// If a Post request is made to /api/messages on port 3978 of our local server, then we pass it to the bot connector to handle
server.post('/api/messages', connector.listen());

var luisRecognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/2956d26e-9d47-4da0-a47f-936d0cd4d764?subscription-key=ed6a31ca35044f84a68f77fb07291f99');
var intentDialog = new builder.IntentDialog({recognizers: [luisRecognizer]});


intentDialog.matches(/\b(hi|hello|hey|howdy)\b/i, '/sayHi')
    .matches("getNews", '/topNews')
    .matches("scanImage", '/scanImage')
    .onDefault(builder.DialogAction.send("Sorry, I didn't understand what you said."));

bot.dialog('/', intentDialog);

bot.dialog('/sayHi', function(session){
    session.send("Hi there! Try saying get me the news in Singapore or asking me to scan an image");
    session.endDialog();
});
//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/topNews', [
    function (session){
        // Ask the user which category they would like
        // Choices are separated by |
        builder.Prompts.choice(session, "Which category would you like?", "Technology|Science|Sports|Business|Entertainment|Politics|Health|World|(quit)");
    }, function (session, results, next){
        // The user chose a category
        if (results.response && results.response.entity !== '(quit)') {
           //Show user that we're processing their request by sending the typing indicator
            session.sendTyping();
            // Build the url we'll be calling to get top news
            var url = "https://api.cognitive.microsoft.com/bing/v5.0/news/?" 
                + "category=" + results.response.entity + "&count=10&mkt=en-US&originalImg=true";
            // Build options for the request
            var options = {
                uri: url,
                headers: {
                    'Ocp-Apim-Subscription-Key': BINGSEARCHKEY
                },
                json: true // Returns the response in json
            }
            //Make the call
            rp(options).then(function (body){
                // The request is successful
                sendTopNews(session, results, body); // Prints the body out to the console in json format
                session.send("Managed to get your news.");
            }).catch(function (err){
                // An error occurred and the request failed
                console.log(err.message);
                session.send("Argh, something went wrong. :( Try again?");
            }).finally(function () {
                // This is executed at the end, regardless of whether the request is successful or not
                session.endDialog();
            });
        } else {
            // The user choses to quit
            session.endDialog("Ok. Mission Aborted.");
        }
    }
]);

bot.dialog('/scanImage', [
    function (session){
        // Ask the user which category they would like
        // Choices are separated by |
        builder.Prompts.text(session, "Send me an image link of it please.");
    }, function (session, results, next){
        // The user chose a category
        if (results.response && results.response.entity !== '(quit)') {
           //Show user that we're processing their request by sending the typing indicator
            session.sendTyping();
            var options = {
                method: 'POST',
                uri: 'https://westus.api.cognitive.microsoft.com/vision/v1.0/describe',
                headers: {
                    'Ocp-Apim-Subscription-Key': 'aa18e86e4f0f4fc98b29bfb6d7dc84b2',
                    'Content-type': 'application/json'
                },
                body:{
                    url: results.response
                },
                json: true // Returns the response in json  
            }
            //Make the call
            rp(options).then(function (body){
                // The request is successful
                session.send("I think it's " + body.description.captions[0].text);
            }).catch(function (err){
                // An error occurred and the request failed
                console.log(err.message);
                session.send("Argh, something went wrong. :( Try again?");
            }).finally(function () {
                // This is executed at the end, regardless of whether the request is successful or not
                session.endDialog();
            });
        } else {
            // The user choses to quit
            session.endDialog("Ok. Mission Aborted.");
        }
    }
]);

function sendTopNews(session, results, body){
    session.send("Top news in " + results.response.entity + ": ");
    //Show user that we're processing by sending the typing indicator
    session.sendTyping();
    // The value property in body contains an array of all the returned articles
    var allArticles = body.value;
    var cards = [];
    // Iterate through all 10 articles returned by the API
    for (var i = 0; i < 10; i++){
        var article = allArticles[i];
        // Create a card for the article and add it to the list of cards we want to send
        cards.push(new builder.HeroCard(session)
            .title(article.name)
            .subtitle(article.datePublished)
            .images([
                //handle if thumbnail is empty
                builder.CardImage.create(session, article.image.contentUrl)
            ])
            .buttons([
                // Pressing this button opens a url to the actual article
                builder.CardAction.openUrl(session, article.url, "Full article")
            ]));
    }
    var msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(cards);
    session.send(msg);
}