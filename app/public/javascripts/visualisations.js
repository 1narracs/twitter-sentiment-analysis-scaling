const serverData= {hashtagData: [
    { hashtag: 'batman', sentiment: 'very-negative', value: '2' },
    { hashtag: 'batman', sentiment: 'negative', value: '4' },
    { hashtag: 'batman', sentiment: 'somewhat-negative', value: '7' },
    { hashtag: 'batman', sentiment: 'somewhat-positive', value: '15' },
    { hashtag: 'batman', sentiment: 'positive', value: '8' },
    { hashtag: 'batman', sentiment: 'very-positive', value: '10' },
    { hashtag: 'spiderman', sentiment: 'very-negative', value: '20' },
    { hashtag: 'spiderman', sentiment: 'negative', value: '3' },
    { hashtag: 'spiderman', sentiment: 'somewhat-negative', value: '9' },
    { hashtag: 'spiderman', sentiment: 'somewhat-positive', value: '14' },
    { hashtag: 'spiderman', sentiment: 'positive', value: '13' },
    { hashtag: 'spiderman', sentiment: 'very-positive', value: '3' }
],
    importantWords: 
    [{
        name: 'batman',
        children: [
            { name: "jamesthefourth"},
            { name: "amazing" },
            { name: "tomeu" },
            { name: "morey" },
            { name: "care" },
            { name: "anyway" },
            { name: "script" },
            { name: "colors" },
            { name: "oh" },
            { name: "wow" }
        ]
    },
    {
        name: 'spiderman',
        children: [
            { name: "hello" },
            { name: "this" },
            { name: "is" },
            { name: "a" },
            { name: "test" },
            { name: "wow" }
        ]
    }
    ]
};



function PrepareData(data) {

    // A map to prepare the hashtag sentiment info for visualisation with D3.js
    const sentiments={
        "very-negative": { name: "Very Negative", sign: -1 },
        "negative": { name: "Negative", sign: -1 },
        "somewhat-negative": { name: "Somewhat Negative", sign: -1 },
        "somewhat-positive": { name: "Somewhat Positive", sign: 1 },
        "positive": { name: "Positive", sign: 1 },
        "very-positive": { name: "Very Positive", sign: 1 }
    };

    // Compute the total number of sentiments for each hashtag.
    const total=d3.rollup(data, D => d3.sum(D, d => d.value), d => d.hashtag);

    // Lastly, convert the counts to signed counts
    // and compute the normalized counts. 
    // The returned array has an extra "sentiments" property which we use to
    // see the z-domain of the chart for stable ordering and color.SS
    return Object.assign(data.map(d => ({
        hashtag: d.hashtag,
        sentiment: sentiments[d.sentiment].name,
        value: d.value*sentiments[d.sentiment].sign,
        proportion: d.value/total.get(d.hashtag)*sentiments[d.sentiment].sign
    })), {
        sentiments: Object.values(sentiments).map(d => d.name)
    });

}

var prepedSentimentData = PrepareData(serverData.hashtagData);

const sentimentChart=StackedBarChart(prepedSentimentData, {
    x: d => d.proportion,
    y: d => d.hashtag,
    z: d => d.sentiment,
    // title: "Tweet Sentiments",
    xFormat: "+%",
    xLabel: "← Negative Sentiment · Sentiment · Positive Sentiment →",
    yDomain: d3.groupSort(prepedSentimentData, D => d3.sum(D, d => -Math.min(0, d.proportion)), d => d.hashtag),
    zDomain: prepedSentimentData.sentiments,
    width:1140,
    height:120,
    marginLeft: 70
});

d3.select("#barchart").html(sentimentChart.outerHTML);

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/diverging-stacked-bar-chart
function StackedBarChart(data, {
    x=d => d, // given d in data, returns the (quantitative) x-value
    y=(d, i) => i, // given d in data, returns the (ordinal) y-value
    z=() => 1, // given d in data, returns the (categorical) z-value
    title, // given d in data, returns the title text
    marginTop=30, // top margin, in pixels
    marginRight=0, // right margin, in pixels
    marginBottom=0, // bottom margin, in pixels
    marginLeft=40, // left margin, in pixels
    width, // outer width, in pixels
    height, // outer height, in pixels
    xType=d3.scaleLinear, // type of x-scale
    xDomain, // [xmin, xmax]
    xRange=[marginLeft, width-marginRight], // [left, right]
    yDomain, // array of y-values
    yRange, // [bottom, top]
    yPadding=0.2, // amount of y-range to reserve to separate bars
    zDomain, // array of z-values
    offset=d3.stackOffsetDiverging, // stack offset method
    order=(series) => { // stack order method; try also d3.stackOffsetNone
        return [ // by default, stack negative series in reverse order
            ...series.map((S, i) => S.some(([, y]) => y<0)? i:null).reverse(),
            ...series.map((S, i) => S.some(([, y]) => y<0)? null:i)
        ].filter(i => i!==null);
    },
    xFormat, // a format specifier string for the x-axis
    xLabel, // a label for the x-axis
    colors // array of colors
}={}) {
    // Compute values.
    const X=d3.map(data, x);
    const Y=d3.map(data, y);
    const Z=d3.map(data, z);

    // Compute default y- and z-domains, and unique them.
    if (yDomain===undefined) yDomain=Y;
    if (zDomain===undefined) zDomain=Z;
    yDomain=new d3.InternSet(yDomain);
    zDomain=new d3.InternSet(zDomain);

    // Omit any data not present in the y- and z-domains.
    const I=d3.range(X.length).filter(i => yDomain.has(Y[i])&&zDomain.has(Z[i]));

    // If the height is not specified, derive it from the y-domain.
    if (height===undefined) height=yDomain.size*25+marginTop+marginBottom;
    if (yRange===undefined) yRange=[height-marginBottom, marginTop];

    // Compute a nested array of series where each series is [[x1, x2], [x1, x2],
    // [x1, x2], …] representing the x-extent of each stacked rect. In addition,
    // each tuple has an i (index) property so that we can refer back to the
    // original data point (data[i]). This code assumes that there is only one
    // data point for a given unique y- and z-value.
    const series=d3.stack()
        .keys(zDomain)
        .value(([, I], z) => X[I.get(z)])
        .order(order)
        .offset(offset)
        (d3.rollup(I, ([i]) => i, i => Y[i], i => Z[i]))
        .map(s => s.map(d => Object.assign(d, { i: d.data[1].get(s.key) })));

    // Compute the default y-domain. Note: diverging stacks can be negative.
    if (xDomain===undefined) xDomain=d3.extent(series.flat(2));

    // Chose a default color scheme based on cardinality.
    if (colors===undefined) colors=d3.schemeSpectral[zDomain.size];
    if (colors===undefined) colors=d3.quantize(d3.interpolateSpectral, zDomain.size);

    // Construct scales, axes, and formats.
    const xScale=xType(xDomain, xRange);
    const yScale=d3.scaleBand(yDomain, yRange).paddingInner(yPadding);
    const color=d3.scaleOrdinal(zDomain, colors);
    const xAxis=d3.axisTop(xScale).ticks(width/80, xFormat);
    const yAxis=d3.axisLeft(yScale).tickSize(0);

    // Compute titles.
    if (title===undefined) {
        const formatValue=xScale.tickFormat(100, xFormat);
        title=i => `${Y[i]}\n${Z[i]}\n${formatValue(X[i])}`;
    } else {
        const O=d3.map(data, d => d);
        const T=title;
        title=i => T(O[i], i, data);
    }

    const svg=d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

    svg.append("g")
        .attr("transform", `translate(0,${marginTop})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("y2", height-marginTop-marginBottom)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", xScale(0))
            .attr("y", -22)
            .attr("fill", "currentColor")
            .attr("text-anchor", "middle")
            .text(xLabel));

    const bar=svg.append("g")
        .selectAll("g")
        .data(series)
        .join("g")
        .attr("fill", ([{ i }]) => color(Z[i]))
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", ([x1, x2]) => Math.min(xScale(x1), xScale(x2)))
        .attr("y", ({ i }) => yScale(Y[i]))
        .attr("width", ([x1, x2]) => Math.abs(xScale(x1)-xScale(x2)))
        .attr("height", yScale.bandwidth());

    if (title) bar.append("title")
        .text(({ i }) => title(i));

    svg.append("g")
        .attr("transform", `translate(${xScale(0)},0)`)
        .call(yAxis)
        .call(g => g.selectAll(".tick text")
            .attr("dx", -3)
            .attr("x", y => { // Find the minimum x-value for the corresponding y-value.
                const x=d3.min(series, S => S.find(d => Y[d.i]===y)?.[0]);
                return xScale(x)-xScale(0);
            }));

    return Object.assign(svg.node(), { scales: { color } });
};


// Collapsible Tree Stuff
// reverse data array to match order of sentiment graph
serverData.importantWords.slice().reverse().forEach(element => {
    var tidyTree = TidyTree(element);
    d3.select('#collapsibletree')
        .append('div.row')
        .html(tidyTree.outerHTML);
});

// Copyright 2017 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/tidy-tree
function TidyTree(data, {
    width = 570,
    tree = data => {
        const root = d3.hierarchy(data);
        root.dx = 10;
        root.dy = width / (root.height + 1);
        return d3.tree().nodeSize([root.dx, root.dy])(root);
      },
}={}) {
  
    const root = tree(data);

    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
    });
  
    const svg = d3.create("svg")
        .attr("viewBox", [0, 0, width, x1 - x0 + root.dx * 2]);
    
    const g = svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("transform", `translate(${root.dy / 3},${root.dx - x0})`);
      
    const link = g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
    .selectAll("path")
      .data(root.links())
      .join("path")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x));
    
    const node = g.append("g")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
      .selectAll("g")
      .data(root.descendants())
      .join("g")
        .attr("transform", d => `translate(${d.y},${d.x})`);
  
    node.append("circle")
        .attr("fill", d => d.children ? "#555" : "#999")
        .attr("r", 2.5);
  
    node.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d.children ? -6 : 6)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name)
      .clone(true).lower()
        .attr("stroke", "white");
    
    return svg.node();
};
