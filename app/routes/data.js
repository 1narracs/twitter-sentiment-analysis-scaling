const { query } = require('express');
const express = require('express');
const natural = require('natural');
const Twitter = require('twitter');
const router = express.Router();

require('dotenv').config()

// Stopwords retrieved from NLTK library: https://gist.github.com/sebleier/554280
const stopwords = ['i','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now']
const maxNumberKeyTerms = 10;

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
                let tweet = tweets.statuses[i].full_text;
                // Remove any text with RT (retweet)
                tweet = tweet.replace('RT ', '');
                // Remove any links
                tweet = tweet.replace(/(?:https?):\/\/[\n\S]+/g, '')
                // Lowercase all words.
                tweet = tweet.toLowerCase();

                groupedTweets.push(tweet); 
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
                const tweetsTokens = tokenizer.tokenize(groupedTweets[i]);
                groupedTweetsTokens.push(tweetsTokens);
            }
            console.log(groupedTweetsTokens);
            console.log("Tokens got\n");


            // ------------------------ Get sentiments ------------------------  //
            const tweetSentiments = [];
            const tweetSentimentsWithTweets = []
            const Analyser = natural.SentimentAnalyzer;
            const stemmer = natural.PorterStemmer;
            const analyser = new Analyser("English", stemmer, "afinn");
            for (let i = 0; i < groupedTweetsTokens.length; i++){
                const tweetSentiment = analyser.getSentiment(groupedTweetsTokens[i]);
                tweetSentiments.push(tweetSentiment);
                // Create an object of tweet data
                // Normally, the array of groupedTweets would be used to get the tweet, but we can't rely it
                const tweetData = {
                    tweet: groupedTweetsTokens[i].join(' '),
                    sentiment: tweetSentiment
                }
                tweetSentimentsWithTweets.push(tweetData);
            }
            console.log(tweetSentiments);
            console.log("Tweet sentiments got\n");


            // ------------------------ Get important terms ------------------------  //
            const TfIdf = natural.TfIdf;
            const tfidf = new TfIdf();
            let filteredTweets = [];
            for (let i = 0; i < groupedTweetsTokens.length; i++){
                for (let j = 0; j < groupedTweetsTokens[i].length; j++){
                    let singularToken = groupedTweetsTokens[i][j]
                    if (!stopwords.includes(singularToken) && singularToken != tag){
                        filteredTweets.push(singularToken);
                    }
                }
            }
            tfidf.addDocument(filteredTweets);
            // Get an array of terms, that is sorted by importance
            const twitterFrequentTerms = [];
            const allKeyTerms = tfidf.listTerms(0);
            for (let i = 0; i < maxNumberKeyTerms; i++){
                twitterFrequentTerms.push(allKeyTerms[i].term);
            }

            console.log(twitterFrequentTerms);
            console.log('Terms displayed \n');


            // ------------------------ Create data object ------------------------  //
            let totalSentiment = 0;
            for (let i = 0; i < tweetSentiments.length; i++){
                totalSentiment += tweetSentiments[i];
            }
            const averageSentiment = totalSentiment / tweetSentiments.length;

            const dummyDataV2 = {
                tagName: tag,
                source: 'dummy source 2',
                overallSentiment: averageSentiment,
                importantTerms: twitterFrequentTerms,
                tweets: tweetSentimentsWithTweets
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
        count: 5,
        result_type: 'popular',
        tweet_mode: 'extended'
    };
}

module.exports = router;
