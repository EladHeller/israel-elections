/* eslint-disable no-undef */
export default (electionsResults, electionsNumber, type) => {
  const data = Object.entries(electionsResults[type])
    .map(([key, {votes, mandats}]) => ({key, votes, mandats, color: '#80cbc4'}))
    .sort((a, b) => b.votes - a.votes);
  d3.select('h1').style('display', 'none');
  d3.selectAll('.select').style('display', 'flex');
  const svg = d3.select('svg');
  svg.html('');

  const margin = 80;
  const width = 1000 - 2 * margin;
  const height = 600 - 2 * margin;

  const chart = svg.append('g')
    .attr('transform', `translate(${margin}, ${margin})`);

  const xScale = d3.scaleBand()
    .range([0, width])
    .domain(data.map((s) => s.key))
    .padding(0.4);

  const domainY = data[0] ? Math.ceil(data[0].mandats / 10) * 10 : 30;

  const yScale = d3.scaleLinear()
    .range([height, 0])
    .domain([0, domainY]);

  const makeYLines = () => d3.axisLeft()
    .scale(yScale);

  chart.append('g')
    .attr('transform', `translate(0, ${height})`)
    .call(d3.axisBottom(xScale));

  chart.append('g')
    .call(d3.axisLeft(yScale));

  chart.append('g')
    .attr('class', 'grid')
    .call(makeYLines()
      .tickSize(-width, 0, 0)
      .tickFormat(''));

  const barGroups = chart.selectAll()
    .data(data)
    .enter()
    .append('g');

  barGroups
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (g) => xScale(g.key))
    .attr('y', (g) => yScale(g.mandats))
    .attr('height', (g) => height - yScale(g.mandats))
    .attr('width', xScale.bandwidth())
    .on('mouseenter', () => {
      d3.selectAll('.value')
        .attr('opacity', 0);

      const texts = barGroups.append('text')
        .attr('class', 'divergence')
        .attr('fill', 'white')
        .attr('text-anchor', 'middle');
      texts.append('tspan')
        .attr('y', (a) => yScale(a.mandats) + 15)
        .attr('x', (a) => xScale(a.key) + xScale.bandwidth() / 2)
        .text((a) => a.votes);
      texts.append('tspan')
        .attr('y', (a) => yScale(a.mandats) + 27)
        .attr('x', (a) => xScale(a.key) + xScale.bandwidth() / 2)
        .text('קולות');
    })
    .on('mouseleave', () => {
      d3.selectAll('.value')
        .attr('opacity', 1);

      chart.selectAll('.divergence').remove();
    });

  barGroups
    .append('text')
    .attr('class', 'value')
    .attr('x', (a) => xScale(a.key) + xScale.bandwidth() / 2)
    .attr('y', (a) => yScale(a.mandats) + 15)
    .attr('text-anchor', 'middle')
    .text((a) => `${a.mandats}`);

  svg
    .append('text')
    .attr('class', 'label')
    .attr('x', -(height / 2) - margin)
    .attr('y', margin / 2.4)
    .attr('transform', 'rotate(-90)')
    .attr('text-anchor', 'middle')
    .text('מנדטים');

  svg.append('text')
    .attr('class', 'label')
    .attr('x', width / 2 + margin)
    .attr('y', height + margin * 1.7)
    .attr('text-anchor', 'middle')
    .text('מפלגות');

  svg.append('text')
    .attr('class', 'title')
    .attr('x', width / 2 + margin)
    .attr('y', 40)
    .attr('text-anchor', 'middle')
    .text(`תוצאות הבחירות לכנסת ה-${electionsNumber}`);
  if (electionsNumber === '23') {
    const time = new Date(electionsResults.time);
    const formattedTime = `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`;
    svg.append('text')
      .attr('x', width / 2 + margin)
      .attr('y', 60)
      .attr('text-anchor', 'middle')
      .text(`מעודכן ל-${formattedTime}`);
  }

  svg.append('a')
    .attr('class', 'source')
    .attr('href', 'https://github.com/EladHeller/israel-elections')
    .attr('target', '_blank')
    .attr('rel', 'noopener noreferrer')
    .append('text')
    .attr('text-anchor', 'start')
    .style('fill', '#55aaff')
    .attr('x', width - margin / 2)
    .attr('y', height + margin * 1.7)
    .text('קוד מקור');

  const sumVotes = Object.values(electionsResults.voteData).reduce((acc, {votes}) => acc + votes, 0);
  svg.append('text')
    .attr('text-anchor', 'start')
    .style('fill', '#fff')
    .attr('x', margin * 3)
    .attr('y', height + margin * 1.7)
    .text(`סה"כ קולות כשרים - ${sumVotes}`);
};
