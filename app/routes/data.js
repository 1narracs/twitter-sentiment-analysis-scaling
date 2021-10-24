const express = require('express');
const natural = require('natural');
const Twitter = require('twitter');
const redis = require('redis');
const AWS = require("aws-sdk");
const router = express.Router();

require('dotenv').config()

// Stopwords retrieved from NLTK library: https://gist.github.com/sebleier/554280
const stopwords = ['i','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now']

const maxNumberKeyTerms = 10;

const sentimentLowerLimitVeryPositive = 0.66667;
const sentimentLowerLimitPositive = 0.33333;
const sentimentLowerLimitSomewhatPositive = 0;
const sentimentLowerLimitSomewhatNegative = -0.33333;
const sentimentLowerLimitNegative = -0.66667;
const sentimentLowerLimitVeryNegative = -1;

// Redis configuration
const redisClient = redis.createClient();
redisClient.on('error', (err) => {
    console.log("Error " + err);
});

const bucketName = 'n9469818-n10763929-twitter-application';

router.get('/twitter/:tag', function(req, res) {

    const { tag } = req.params;

    const keyFullDataObject = `twitter:${tag}-all`;
    const s3Params = {Bucket: bucketName, Key: keyFullDataObject};

    // Try getting full data object from cache
    return redisClient.get(keyFullDataObject, (err, cacheResult) =>{
        if (cacheResult){
            // Serve from cache
            console.log('Full data served from cache');
            const cacheResultJSON = JSON.parse(cacheResult);
            return res.json(cacheResultJSON.twitterDataObject);
        }
        else{
            // Try getting full data object from S3
            
            return new AWS.S3({apiVersion: '2006-03-01'}).getObject(s3Params, (err, s3Result) => {
                if (s3Result) {
                    // Serve from S3
                    console.log("Full data served from S3");
                    const s3ResultParsed = JSON.parse(s3Result.Body);
                    const twitterDataObject = s3ResultParsed.twitterDataObject;
                    twitterDataObject.source = 'Redis Cache';
                    // Add to cache
                    redisClient.setex(keyFullDataObject, 3600, JSON.stringify({twitterDataObject}));
                    twitterDataObject.source = 'S3 Bucket';
                    return res.json(twitterDataObject);
                } else {
                    // Attempt to serve from Twitter API and store it in S3 and Cache
                    GetProcessedSentiment(tag)
                    .then((sentimentData) => {
                        console.log("sentimentData get");
                        GetImportantTerms(tag)
                        .then((twitterImportantTerms) =>{
                            console.log("Full data served from GetProcessedSentiment and GetImportantTerms");
                            // ------------------------ Create data object ------------------------  //
                            const twitterDataObject = {
                                id: tag,
                                source: 'S3 Bucket',
                                overallSentiment: sentimentData.averageSentiment,
                                sentimentsVeryPositive: sentimentData.sentimentsVeryPositive,
                                sentimentsPositive: sentimentData.sentimentsPositive,
                                sentimentsSomewhatPositive: sentimentData.sentimentsSomewhatPositive,
                                sentimentsNeutral: sentimentData.sentimentsNeutral,
                                sentimentsSomewhatNegative: sentimentData.sentimentsSomewhatNegative,
                                sentimentsNegative: sentimentData.sentimentsNegative,
                                sentimentsVeryNegative: sentimentData.sentimentsVeryNegative,
                                importantTerms: twitterImportantTerms
                            }
                            // ------------------------ Store full data object in cache and storage, then delete old storage ------------------------  //
                            // As for the cache, old data is automatically expired after a set amount of seconds (6 minutes)
                            const body = JSON.stringify({twitterDataObject});
                            
                            const objectParams = {Bucket: bucketName, Key: keyFullDataObject, Body: body};
                            const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                            uploadPromise.then(function(data) {
                              console.log("Successfully uploaded full data object to " + bucketName + "/" + keyFullDataObject);
                            })
                            // When the full data object exists in S3, delete the old unnecessary data
                            .then(() =>{
                                const deleteParams = {
                                    Bucket: bucketName, 
                                    Delete: {
                                        Objects: [
                                            {Key: `twitter:${tag}-sentiment-processed`}, 
                                            {Key: `twitter:${tag}-sentiment-unprocessed`}, 
                                            {Key: `twitter:${tag}-important-terms`},
                                            {Key: `twitter:${tag}-tokens`},
                                            {Key: `twitter:${tag}-tweets`}
                                        ] 
                                    }
                                };
                                const deletePromise = new AWS.S3({apiVersion: '2006-03-01'}).deleteObjects(deleteParams).promise();
                                deletePromise.then(function(data) {
                                    console.log('Successfully deleted old data objects');
                                });
                            })
                            .catch((error) =>{
                                console.log('Error uploading/delete objects in S3:\n' + error);
                            });
                            twitterDataObject.source = 'Redis Cache'
                            redisClient.setex(keyFullDataObject, 3600, JSON.stringify({twitterDataObject}));
                            
                            // ------------------------ Return page with data ------------------------  //
                            console.log('Render page with json data');
                            twitterDataObject.source = 'Backend Server Functions'
                            return res.json(twitterDataObject);
                            // Delete S3 storage if full data object is confirmed to be in s3?
                        })
                        .catch((error) => {
                            console.log(error)
                            const errorData = {
                                id: tag,
                                source: 'No Source',
                                errorCause: error
                            }
                            return res.json (errorData);
                        });
                    })
                    .catch((error) =>{
                        const errorData = {
                            id: tag,
                            source: 'No Source',
                            errorCause: error
                        }
                        return res.json (errorData);
                    });
                }
            })
        }
    })
});

// ------------------------ Process sentiment data ------------------------  //
function GetProcessedSentiment(id){
    return new Promise(function(resolve, reject){
        const keySentimentProcessed = `twitter:${id}-sentiment-processed`;

        // Try getting processed sentiment data object from cache
        redisClient.get(keySentimentProcessed, (err, cacheResult) =>{
            if (cacheResult){
                // Serve from cache
                console.log('Processed sentiment served from cache');
                const cacheResultParsed = JSON.parse(cacheResult);
                resolve(cacheResultParsed.processedSentimentObject);
            }
            else{
                // Try getting processed sentiment data object from S3
                const params = {Bucket: bucketName, Key: keySentimentProcessed};
                
                new AWS.S3({apiVersion: '2006-03-01'}).getObject(params, (err, s3Result) => {
                    if (s3Result) {
                        // Serve from S3
                        console.log("Processed sentiment served from S3");
                        const s3ResultParsed = JSON.parse(s3Result.Body);
                        // Add to cache
                        redisClient.setex(keySentimentProcessed, 360, s3Result.Body);
                        resolve(s3ResultParsed.processedSentimentObject);
                    } else {
                        // Serve from Twitter API and store in S3 and Cache
                        console.log("Process sentiment served from GetSentiments");

                        GetSentiments(id)
                        .then((sentiments) =>{
                            let totalSentiment = 0;
                            let totalCount = 0;
                            let veryPositiveSentiments = 0;
                            let positiveSentiments = 0;
                            let somewhatPositiveSentiments = 0;
                            let neutralSentiments = 0;
                            let somewhatNegativeSentiments = 0;
                            let negativeSentiments = 0;
                            let veryNegativeSentiments = 0;

                            for (let i = 0; i < sentiments.length; i++){
                                const sentimentValue = sentiments[i];
                                if (sentimentValue == 0){
                                    neutralSentiments++
                                }
                                else{
                                    totalCount++;
                                    totalSentiment += sentimentValue;
                                    if (sentimentValue >= sentimentLowerLimitVeryPositive){
                                        veryPositiveSentiments++;
                                    }
                                    else if (sentimentValue >= sentimentLowerLimitPositive){
                                        positiveSentiments++;
                                    }
                                    else if (sentimentValue > sentimentLowerLimitSomewhatPositive){
                                        somewhatPositiveSentiments++;
                                    }
                                    else if (sentimentValue >= sentimentLowerLimitSomewhatNegative){
                                        somewhatNegativeSentiments++;
                                    }
                                    else if (sentimentValue >= sentimentLowerLimitNegative){
                                        negativeSentiments++;
                                    }
                                    else if (sentimentValue >= sentimentLowerLimitVeryNegative){
                                        veryNegativeSentiments++;
                                    }
                                }
                            }

                            const processedSentimentObject = {
                                averageSentiment: totalSentiment / totalCount,
                                sentimentsVeryPositive: veryPositiveSentiments,
                                sentimentsPositive: positiveSentiments,
                                sentimentsSomewhatPositive: somewhatPositiveSentiments,
                                sentimentsNeutral: neutralSentiments,
                                sentimentsSomewhatNegative: somewhatNegativeSentiments,
                                sentimentsNegative: negativeSentiments,
                                sentimentsVeryNegative: veryNegativeSentiments
                            }
                            console.log('Sentiment processed');
                            // ------------------------ Store processed sentiment object in cache and storage ------------------------  //
                            const body = JSON.stringify({ processedSentimentObject });
                            const objectParams = {Bucket: bucketName, Key: keySentimentProcessed, Body: body};
                            const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                            uploadPromise.then(function(data) {
                              console.log("Successfully uploaded processed sentiment object to " + bucketName + "/" + keySentimentProcessed);
                            })
                            .catch((error) =>{
                                console.log('Error uploading processed sentiment to S3:\n' + error);
                            });
                            redisClient.setex(keySentimentProcessed, 360, body);
                            // ------------------------ Resolve Promise ------------------------  //
                            resolve(processedSentimentObject);
                        })
                        .catch((error) => {
                            console.log('Error at processed sentiments: ' + error);
                            reject(error);
                        })
                    }
                });
            }
        })
    });
}

// ------------------------ Get important terms ------------------------  //
function GetImportantTerms(id){
    return new Promise(function(resolve, reject){
        const keyImportantTerms = `twitter:${id}-important-terms`;

        // Try getting full data object from cache
        redisClient.get(keyImportantTerms, (err, cacheResult) =>{
            if (cacheResult){
                // Serve from cache
                console.log('Unprocessed sentiment served from cache');
                const cacheResultParsed = JSON.parse(cacheResult);
                resolve(cacheResultParsed.twitterFrequentTerms);
            }
            else{
                // Try getting data from S3
                const params = {Bucket: bucketName, Key: keyImportantTerms};
                
                new AWS.S3({apiVersion: '2006-03-01'}).getObject(params, (err, s3Result) => {
                    if (s3Result) {
                        // Serve from S3
                        console.log("Unprocessed sentiment served from S3");
                        const s3ResultParsed = JSON.parse(s3Result.Body);
                        // Add to cache
                        redisClient.setex(keyImportantTerms, 360, s3Result.Body);
                        resolve(s3ResultParsed.twitterFrequentTerms)
                    } else {
                        // Serve from Twitter API and store in S3 and Cache
                        console.log("Important terms served from TokenizeTweets");

                        TokenizeTweets(id)
                        .then((groupedTweetsTokens) =>{
                            const TfIdf = natural.TfIdf;
                            const tfidf = new TfIdf();
                            let tweetsCollated = [];
                            // Search through all the tokens, then add each token to a list of terms if the requirements are met
                            for (let i = 0; i < groupedTweetsTokens.length; i++){
                                for (let j = 0; j < groupedTweetsTokens[i].length; j++){
                                    let singularToken = groupedTweetsTokens[i][j]
                                    // Don't include stop words or the user query as possible important terms
                                    if (!stopwords.includes(singularToken) && singularToken != id){
                                        tweetsCollated.push(singularToken);
                                    }
                                }
                            }
                            tfidf.addDocument(tweetsCollated);
                            // Get an array of terms, that is sorted by importance
                            const twitterFrequentTerms = [];
                            const allKeyTerms = tfidf.listTerms(0);
                            for (let i = 0; i < maxNumberKeyTerms; i++){
                                const foundTerm = allKeyTerms[i].term;
                                if (foundTerm == null){
                                    console.log('Finding important terms cut short at index: ' + i);
                                    break;
                                }
                                twitterFrequentTerms.push(allKeyTerms[i].term);
                            }
                            console.log('Important terms found');
                            // ------------------------ Store important terms in cache and storage ------------------------  //
                            const body = JSON.stringify({ twitterFrequentTerms });
                            const objectParams = {Bucket: bucketName, Key: keyImportantTerms, Body: body};
                            const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                            uploadPromise.then(function(data) {
                              console.log("Successfully uploaded important terms to " + bucketName + "/" + keyImportantTerms);
                            })
                            .catch((error) =>{
                                console.log('Error uploading important terms to S3:\n' + error);
                            });
                            redisClient.setex(keyImportantTerms, 360, body);
                            // ------------------------ Resolve Promise ------------------------  //
                            resolve(twitterFrequentTerms);
                        })
                        .catch((error) => {
                            console.log('Error at important terms: ' + error);
                            reject(error);
                        });
                    }
                });
            }
        });
    });
}

// ------------------------ Get sentiments ------------------------  //
function GetSentiments(id){
    return new Promise(function(resolve, reject){
        const keySentimentUnprocessed = `twitter:${id}-sentiment-unprocessed`;

        // Try getting full data object from cache
        redisClient.get(keySentimentUnprocessed, (err, cacheResult) =>{
            if (cacheResult){
                // Serve from cache
                console.log('Unprocessed sentiment served from cache');
                const cacheResultParsed = JSON.parse(cacheResult);
                resolve(cacheResultParsed.tweetSentiments);
            }
            else{
                // Try getting data from S3
                const params = {Bucket: bucketName, Key: keySentimentUnprocessed};
                
                new AWS.S3({apiVersion: '2006-03-01'}).getObject(params, (err, s3Result) => {
                    if (s3Result) {
                        // Serve from S3
                        console.log("Unprocessed sentiment served from S3");
                        const s3ResultParsed = JSON.parse(s3Result.Body);
                        // Add to cache
                        redisClient.setex(keySentimentUnprocessed, 360, s3Result.Body);
                        resolve(s3ResultParsed.tweetSentiments)
                    } else {
                        // Serve from Twitter API and store in S3 and Cache
                        console.log("Unprocessed sentiment served from TokenizeTweets");

                        TokenizeTweets(id)
                        .then((groupedTweetsTokens) =>{
                            const tweetSentiments = [];
                            const Analyser = natural.SentimentAnalyzer;
                            const stemmer = natural.PorterStemmer;
                            const analyser = new Analyser("English", stemmer, "afinn");
                            for (let i = 0; i < groupedTweetsTokens.length; i++){
                                const tweetSentiment = analyser.getSentiment(groupedTweetsTokens[i]);
                                tweetSentiments.push(tweetSentiment);
                            }
                            console.log("Tweet sentiments analysed");
                            // ------------------------ Store unprocessed sentiments in cache and storage ------------------------  //
                            const body = JSON.stringify({ tweetSentiments });
                            const objectParams = {Bucket: bucketName, Key: keySentimentUnprocessed, Body: body};
                            const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                            uploadPromise.then(function(data) {
                              console.log("Successfully uploaded unprocessed sentiments to " + bucketName + "/" + keySentimentUnprocessed);
                            })
                            .catch((error) =>{
                                console.log('Error uploading unprocessed sentiments to S3:\n' + error);
                            });
                            redisClient.setex(keySentimentUnprocessed, 360, body);
                            // ------------------------ Resolve Promise ------------------------  //
                            resolve(tweetSentiments);
                        })
                        .catch((error) =>{
                            console.log('Error at raw sentiments: ' + error);
                            reject(error);
                        })
                    }
                });
            }
        });
    });
}

// ------------------------ Tokenise the tweets ------------------------  //
function TokenizeTweets(id){
    return new Promise(function(resolve, reject){
        const keyTokens = `twitter:${id}-tokens`;

        // Try getting full data object from cache
        redisClient.get(keyTokens, (err, cacheResult) =>{
            if (cacheResult){
                // Serve from cache
                console.log('Tweet tokens served from cache');
                const cacheResultParsed = JSON.parse(cacheResult);
                resolve(cacheResultParsed.tweetsTokens);
            }
            else{
                // Try getting data from S3
                const params = {Bucket: bucketName, Key: keyTokens};
                
                new AWS.S3({apiVersion: '2006-03-01'}).getObject(params, (err, s3Result) => {
                    if (s3Result) {
                        // Serve from S3
                        console.log("Tweet tokens served from S3");
                        const s3ResultParsed = JSON.parse(s3Result.Body);
                        // Add to cache
                        redisClient.setex(keyTokens, 360, s3Result.Body);
                        resolve(s3ResultParsed.tweetsTokens)
                    } else {
                        // Serve from Twitter API and store in S3 and Cache
                        console.log("Tweet tokens served from GetTweets");
                        GetTweets(id)
                        .then((tweets) =>{
                            const tweetsTokens = [];
                            // Use a regular expression to split up words on a pattern of: anything that is not a-z or an apostrophe
                            tokenizer = new natural.RegexpTokenizer({pattern: /[^a-z\'\’]+/});
                            for (let i = 0; i < tweets.length; i++){
                                const tweetTokens = tokenizer.tokenize(tweets[i]);
                                tweetsTokens.push(tweetTokens);
                            }
                            console.log("Tweets tokenized");
                            // ------------------------ Store tokenized tweets in cache and storage ------------------------  //
                            const body = JSON.stringify({ tweetsTokens });
                            const objectParams = {Bucket: bucketName, Key: keyTokens, Body: body};
                            const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                            uploadPromise.then(function(data) {
                              console.log("Successfully uploaded tokenized tweets to " + bucketName + "/" + keyTokens);
                            })
                            .catch((error) =>{
                                console.log('Error uploading tokens to S3:\n' + error);
                            });
                            redisClient.setex(keyTokens, 360, body);
                            // ------------------------ Resolve Promise ------------------------  //
                            resolve(tweetsTokens);
                        })
                        .catch((error) => {
                            console.log('Error at tokens: ' + error);
                            reject(error);
                        });
                    }
                });
            }
        });
    });
}

// ------------------------ Get the tweets ------------------------  //
function GetTweets(id){
    return new Promise(function(resolve, reject){
        const keyTweets = `twitter:${id}-tweets`;

        // Try getting full data object from cache
        redisClient.get(keyTweets, (err, cacheResult) =>{
            if (cacheResult){
                // Serve from cache
                console.log('Tweets served from cache');
                const cacheResultParsed = JSON.parse(cacheResult);
                resolve(cacheResultParsed.groupedTweets);
            }
            else{
                // Try getting data from S3
                const params = {Bucket: bucketName, Key: keyTweets};
                
                new AWS.S3({apiVersion: '2006-03-01'}).getObject(params, (err, s3Result) => {
                    if (s3Result) {
                        // Serve from S3
                        console.log("Tweets served from S3");
                        const s3ResultParsed = JSON.parse(s3Result.Body);
                        // Add to cache
                        redisClient.setex(keyTweets, 360, s3Result.Body);
                        resolve(s3ResultParsed.groupedTweets)
                    } else {
                        console.log("Tweets served from Twitter");
                        const twitterParams = GetTwitterParams(id);
                        twitterClient.get('search/tweets', twitterParams)
                        .then((tweets) => {
                            const groupedTweets = [];
                            for (let i = 0; i < twitterParams.count; i++){
                                if (tweets.statuses[i] != null){
                                    const rawTweet = tweets.statuses[i].full_text;

                                    // Remove any links
                                    let cleanTweet = rawTweet.replace(/(?:https?):\/\/[\n\S]+/g, '')
                                    // Replace ampersands
                                    cleanTweet = cleanTweet.replace(/&amp;/g, 'and')
                                    // Replace newlines with spaces
                                    cleanTweet = cleanTweet.replace(/\n/g, ' ')
                                    // Remove any mention of 'RT' (retweet)
                                    cleanTweet = cleanTweet.replace(/RT */g, '')
                                    // Sentiment analysis performs better when all the words given are in lowercase
                                    cleanTweet = cleanTweet.toLowerCase()
                                    groupedTweets.push(cleanTweet); 
                                }
                                // If less tweets then expected was found, break out of the loop
                                else{
                                    console.log('Array of tweets cut short at index: ' + i);
                                    break;
                                }
                            }
                            console.log("Tweets gathered from twitter and sanitized");

                            if (groupedTweets.length < 1){
                                reject('No tweets were obtained.');
                            }
                            else
                            {
                                // ------------------------ Store raw tweets in cache and storage ------------------------  //
                                const body = JSON.stringify({ groupedTweets });
                                const objectParams = {Bucket: bucketName, Key: keyTweets, Body: body};
                                const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();
                                uploadPromise.then(function(data) {
                                    console.log("Successfully uploaded raw tweets to " + bucketName + "/" + keyTweets);
                                })
                                .catch((error) =>{
                                    console.log('Error uploading raw tweets to S3:\n' + error);
                                });
                                redisClient.setex(keyTweets, 360, body);
                                // ------------------------ Resolve Promise ------------------------  //
                                resolve(groupedTweets);
                            }
                        })
                        .catch((error) =>{
                            console.log(error);
                            reject('Error getting tweets');
                        });
                    }
                });
            }
        });
    });
}


// Create twitter client to be used to obtain tweets
const twitterClient = new Twitter({
    
    consumer_key: process.env.TWITTER_KEY,
    consumer_secret: process.env.TWITTER_SECRET,
    bearer_token: process.env.TWITTER_BEARER
});

// Get parameters of tweets (non-truncated) with the search term query to use in the endpoint
function GetTwitterParams(query){
    return {
        q: '#' + query,
        lang: 'en',
        count: 100,
        result_type: 'recent',
        tweet_mode: 'extended'
    };
}

module.exports = router;