// Token Radar's page logic: pure functions, no DOM. The page recomputes every row's implied
// value from the snapshot figures with impliedOf, and derives every farm plan with farmSteps,
// the same derivation lib/model.ts runs when it writes board.json. The detail view compares the
// two and says so: the number on screen is the number the board carries.
(function () {
  'use strict';

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2) + 'x';
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function round4(n) { return Math.round(n * 1e4) / 1e4; }

  // The model in one function: TVL times the category's comparable multiple, times growth,
  // maturity and chain breadth. The multiple comes from the multiples table the program
  // derived from the snapshot's live protocols; the table's values are rounded to 4 places,
  // and the program scores with those rounded values, so this recompute is exact.
  function multipleFor(category, data) {
    if (!category) return data.global_multiple;
    for (var i = 0; i < data.multiples.length; i++) {
      if (data.multiples[i].category === category) return data.multiples[i].multiple;
    }
    return data.global_multiple;
  }
  function impliedOf(row, data) {
    var m = data.model;
    var growth = clamp(row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d, m.growth_floor, m.growth_cap);
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (clamp(age, 0, m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chains = row.chains ? row.chains.length : 0;
    var chainMult = 1 + Math.min(Math.max(chains - 1, 0), m.breadth_max_chains) * m.breadth_per_chain;
    var catMult = multipleFor(row.category, data);
    return {
      implied: Math.max(1, Math.round(row.tvl_usd * catMult * growthMult * maturity * chainMult)),
      categoryMultiple: catMult,
      growthPct: growth,
      growthMultiplier: round4(growthMult),
      maturityMultiplier: round4(maturity),
      chainMultiplier: round4(chainMult)
    };
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL
  // and age decide the action, the capital, the hold and every cost and time. No name is
  // special-cased, and no step promises a token.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function small(capital) { return Math.max(10, Math.round(capital / 5)); }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and leave the deposit earning.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s deepest pool on " + chain + ' and keep the position open.';
    if (c.indexOf('yield') >= 0 || c.indexOf('vault') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('risk') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the receipt tokens.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then use the bridged funds inside its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' on ' + name + ' and take one small position in an open market.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it in the farming wallet.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('payment') >= 0) return 'Pay or receive $' + capital + ' through ' + name + ' on ' + chain + ' and keep the volume on one wallet.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' to ' + name + "'s chain and use one of its native apps for a real transaction.";
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s incentive pool on " + chain + ' and take part in its votes.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s basis vault on " + chain + ' and keep the position open.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount, about $' + small(capital) + ', against the deposit and repay it within the week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add a second, smaller position of about $' + small(capital) + ' to another ' + name + ' pool on ' + chain + '.';
    if (c.indexOf('yield') >= 0 || c.indexOf('vault') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('risk') >= 0) return 'Move about $' + small(capital) + ' into a second ' + name + ' vault so the wallet touches two products.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a second, smaller amount of about $' + small(capital) + ' back through ' + name + ' within the same week.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim or compound the staking rewards once, keeping the receipt in the same wallet.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Close the first position and open a second one half its size, so the wallet shows two fills.';
    if (c.indexOf('prediction') >= 0) return 'Provide about $' + small(capital) + ' of liquidity to one ' + name + ' market instead of taking a side.';
    if (c.indexOf('stable') >= 0) return 'Swap a small part of the stable holding, about $' + small(capital) + ", through " + name + "'s own route.";
    if (c.indexOf('rwa') >= 0) return "Check the asset's redemption terms on " + name + "'s own page and keep the holding past one payout cycle.";
    if (c.indexOf('insurance') >= 0) return 'Stake about $' + small(capital) + ' in ' + name + "'s cover pool if it offers one, otherwise renew the cover.";
    if (c.indexOf('payment') >= 0) return 'Make a second payment of about $' + small(capital) + ' through ' + name + ' a few days later.';
    if (c.indexOf('chain') >= 0) return 'Use a second native app on ' + name + "'s chain for one more real transaction the same week.";
    if (c.indexOf('governance') >= 0) return "Vote on a second proposal in " + name + "'s governance once one opens.";
    if (c.indexOf('basis') >= 0) return 'Top up the basis position by about $' + small(capital) + ' after the first week.';
    return 'Repeat the deposit with about $' + small(capital) + ' more a week later so the wallet shows repeat activity.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = capital >= 150 ? 8 : 4;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: 'about $' + Math.max(2, Math.round(gas / 2)) + ' of gas', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote where the app offers one.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page from its own site and claim only from the link it publishes, then write every transaction in a farm log.", cost: 'no fee to check, and never pay to claim', time: '15 minutes' }
    ].map(stepText);
  }

  window.RADAR_LOGIC = {
    fmtUsd: fmtUsd,
    fmtPct: fmtPct,
    fmtAge: fmtAge,
    fmtMult: fmtMult,
    impliedOf: impliedOf,
    farmSteps: farmSteps,
    multipleFor: multipleFor
  };
})();
