const { query } = require('express');
const express = require('express');
const natural = require('natural');
const Twitter = require('twitter');
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

/* GET users listing. */
router.get('/twitter/:tag', function(req, res) {
    const { tag } = req.params;
    const dummyData = {
        tagName: tag,
        source: 'dummy source 1',
        overallSentiment: 0.166,
        frequentTerms: ['this', 'tweet'],
        tweets: 
        [
            {
                tweet: "This is a tweet",
                sentiment: 0.3
            },
            {
                tweet: "This is another tweet",
                sentiment: 0.7
            },
            {
                tweet: "This final tweet",
                sentiment: -0.5
            }
        ]
    };
    // If twitter-summary-{tag} does not exist, do the following
    const twitterParams = GetTwitterParams(tag);
    twitterClient.get('search/tweets', twitterParams)
    .then((tweets) => {

        // ------------------------ Get the tweets ------------------------  //
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

                cleanTweet = cleanTweet.replace(/RT */g, '')

                // Remove any text with RT (retweet)
                //let modifiedTweet = rawTweet.replace('RT ', '');
                // Remove any links
                //modifiedTweet = modifiedTweet.replace(/(?:https?):\/\/[\n\S]+/g, '')
                //
                //modifiedTweet = modifiedTweet.replace(/\n|&amp;/g, ' ')
                // Lowercase all words.
                //modifiedTweet = modifiedTweet.toLowerCase();

                const rawTweetObject = {
                    id: tag + i,
                    originalTweet: cleanTweet.toLowerCase()
                }

                groupedTweets.push(rawTweetObject); 
            }
            // If less tweets then expected was found, break out of the loop
            else{
                console.log('Array of tweets cut short at index: ' + i);
                break;
            }
        }
        console.log(groupedTweets);
        console.log("Group tweets got\n");

        if (groupedTweets.length < 1){
            const noData = {
                tagName: tag,
                source: 'No Source',
            };
            res.json(noData);
        }
        else{
            // ------------------------ Tokenise the tweets ------------------------  //
            const groupedTweetsTokens = [];
            // Regular expression, split up words that have 0 or more ':', 0 or more ',' and 1 or more spaces.
            tokenizer = new natural.RegexpTokenizer({pattern: /[^a-z\'\’]+/});
            for (let i = 0; i < groupedTweets.length; i++){
                const tweetTokens = tokenizer.tokenize(groupedTweets[i].originalTweet);
                const tokenObject = {
                    id: groupedTweets[i].id,
                    tokens: tweetTokens
                }
                groupedTweetsTokens.push(tokenObject);
            }
            console.log(groupedTweetsTokens);
            console.log("Tokens got\n");


            // ------------------------ Get sentiments ------------------------  //
            const tweetSentiments = [];
            //const tweetSentimentsWithTweets = []
            const Analyser = natural.SentimentAnalyzer;
            const stemmer = natural.PorterStemmer;
            const analyser = new Analyser("English", stemmer, "afinn");
            //const analyser = new Analyser("English", stemmer, "senticon");
            //const analyser = new Analyser("English", stemmer, "pattern");
            for (let i = 0; i < groupedTweetsTokens.length; i++){
                const tweetSentiment = analyser.getSentiment(groupedTweetsTokens[i].tokens);
                //tweetSentiments.push(tweetSentiment);
                // Create an object of tweet data
                // Normally, the array of groupedTweets would be used to get the tweet, but we can't rely it
                const sentimentObject = {
                    id: groupedTweetsTokens[i].id,
                    sentiment: tweetSentiment
                }
                tweetSentiments.push(sentimentObject);
            }
            console.log(tweetSentiments);
            console.log("Tweet sentiments got\n");


            // ------------------------ Get important terms ------------------------  //
            const TfIdf = natural.TfIdf;
            const tfidf = new TfIdf();
            let tweetsCollated = [];
            // Search through all the tokens, then add each token to a list of terms if the requirements are met
            for (let i = 0; i < groupedTweetsTokens.length; i++){
                for (let j = 0; j < groupedTweetsTokens[i].tokens.length; j++){
                    let singularToken = groupedTweetsTokens[i].tokens[j]
                    // Don't include stop words, the user query, or rt (retweet) as possible important terms
                    if (!stopwords.includes(singularToken) && singularToken != tag && singularToken != 'rt'){
                        tweetsCollated.push(singularToken);
                    }
                }
            }
            tfidf.addDocument(tweetsCollated);
            // Get an array of terms, that is sorted by importance
            const twitterFrequentTerms = [];
            const allKeyTerms = tfidf.listTerms(0);
            for (let i = 0; i < maxNumberKeyTerms; i++){
                twitterFrequentTerms.push(allKeyTerms[i].term);
            }

            console.log(twitterFrequentTerms);
            console.log('Terms displayed \n');


            // ------------------------ Process sentiment data ------------------------  //
            let totalSentiment = 0;

            let veryPositiveSentiments = 0;
            let positiveSentiments = 0;
            let somewhatPositiveSentiments = 0;
            let neutralSentiments = 0;
            let somewhatNegativeSentiments = 0;
            let negativeSentiments = 0;
            let veryNegativeSentiments = 0;
            for (let i = 0; i < tweetSentiments.length; i++){
                const sentimentValue = tweetSentiments[i].sentiment;
                totalSentiment += sentimentValue;
                if (sentimentValue == 0){
                    neutralSentiments++
                }
                else if (sentimentValue >= sentimentLowerLimitVeryPositive){
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

            const processedSentimentObject = {
                id: tag,
                averageSentiment: totalSentiment / tweetSentiments.length,
                sentimentsVeryPostive: veryPositiveSentiments,
                sentimentsPositive: positiveSentiments,
                sentimentsSomewhatPositive: somewhatPositiveSentiments,
                sentimentsNeutral: neutralSentiments,
                sentimentsSomewhatNegative: somewhatNegativeSentiments,
                sentimentsNegative: negativeSentiments,
                sentimentsVeryNegative: veryNegativeSentiments
            }
            //const averageSentiment = totalSentiment / tweetSentiments.length;


            // ------------------------ Collate original tweets with sentiments ------------------------  //
            const allTweets = []
            for (let i = 0; i < groupedTweets.length; i++){
                const originalTweet = groupedTweets[i].originalTweet;
                let tweetSentiment;
                for (let j = 0; j < tweetSentiments.length; j++){
                    if (groupedTweets[i].id == tweetSentiments[j].id){
                        tweetSentiment = tweetSentiments[j].sentiment;
                        break;
                    }
                }
                const tweetData = {
                    tweet: originalTweet,
                    sentiment: tweetSentiment
                }
                allTweets.push(tweetData);
            }

            // ------------------------ Create data object ------------------------  //

            const dummyDataV2 = {
                tagName: tag,
                source: 'dummy source 2',
                overallSentiment: processedSentimentObject.averageSentiment,
                sentimentsVeryPostive: processedSentimentObject.sentimentsVeryPostive,
                sentimentsPositive: processedSentimentObject.sentimentsPositive,
                sentimentsSomewhatPositive: processedSentimentObject.sentimentsSomewhatPositive,
                sentimentsNeutral: processedSentimentObject.sentimentsNeutral,
                sentimentsSomewhatNegative: processedSentimentObject.sentimentsSomewhatNegative,
                sentimentsNegative: processedSentimentObject.sentimentsNegative,
                sentimentsVeryNegative: processedSentimentObject.sentimentsVeryNegative,
                importantTerms: twitterFrequentTerms,
                tweets: allTweets
            };

            // ------------------------ Return page with data ------------------------  //
            console.log('Page Render');
            res.json(dummyDataV2);
        }
    })
    .catch((error) =>{
        console.log(error)
    });
});

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