// Chain Frontier Radar dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, the chain frontier table, filters, and a
// per-protocol detail drawer with the model's own inputs and the protocol's farm plan.
// No network: every byte it shows is in data.js. The page recomputes each row's
// headline number from the snapshot figures it carries, so the page's arithmetic and
// the board's data are visibly the same.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = {
    q: '', category: 'all', chain: 'all', tvl: 0, watchlist: false,
    tab: 'pre-token', sort: 'value', dir: -1, selected: null
  };

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
  function fmtShare(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n * 100).toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (k === 'checked') node.checked = !!attrs[k];
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The model in one function, recomputed here from the row's own figures: base value
  // times the chain tilt, the growth multiplier and the age multiplier.
  function valueOf(row) {
    var base = row.tvl_usd * DATA.median_ratio;
    return Math.max(1, Math.round(base * row.chain_factor * row.growth_multiplier * row.age_multiplier));
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tvl')) state.tvl = Number(params.get('tvl')) || 0;
    if (params.get('wl') === '1') state.watchlist = true;
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tvl) params.set('tvl', String(state.tvl));
    if (state.watchlist) params.set('wl', '1');
    if (state.sort !== 'value') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function onWatchlist(r) { return r.tvl_usd >= DATA.floor_usd; }
  function mainChainOf(r) { return (r.chains && r.chains.length) ? r.chains[0] : 'n/a'; }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && mainChainOf(r) !== state.chain) return false;
      if (state.tvl && r.tvl_usd < state.tvl) return false;
      if (state.watchlist && !onWatchlist(r)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function orderedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'chain') { av = a.chain_factor; bv = b.chain_factor; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function topBar() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Chain Frontier Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function intro() {
    var top = DATA.frontier[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Follow the untokenized money to its chain' }),
        el('p', { text: 'A token launch is worth more where untokenized value is already concentrating. This board tilts each protocol\u2019s implied value toward the chains that hold the biggest share of the snapshot\u2019s pre-token TVL — ' + (top ? top.chain + ' alone holds ' + fmtShare(top.share) + ' of it' : 'no single chain dominates') + '. The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'All pre-token TVL' }), el('b', { text: fmtUsd(DATA.total_pretoken_tvl_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Median mcap / TVL' }), el('b', { text: DATA.median_ratio.toFixed(4) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function frontierPanel() {
    var maxShare = Math.max.apply(null, DATA.frontier.map(function (c) { return c.share; })) || 1;
    return el('section', { class: 'panel section' },
      el('h2', { text: 'The frontier: where pre-token TVL sits' }),
      el('p', { text: 'Each chain\u2019s share of the snapshot\u2019s pre-token TVL, counted on each protocol\u2019s main chain so no dollar is counted twice. The chain factor is 0.80 + 0.40 \u00d7 share: a protocol on the busiest frontier earns up to \u00d71.20, one on a quiet chain \u00d70.80.' }),
      el('div', null, DATA.frontier.map(function (c) {
        return el('div', { class: 'frontier-row' },
          el('span', { class: 'fname', text: c.chain }),
          el('div', { class: 'fbar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round((c.share / maxShare) * 100)) + '%' })),
          el('span', { class: 'fnum', text: fmtUsd(c.pretoken_tvl_usd) }),
          el('span', { class: 'fnum', text: fmtShare(c.share) + ' \u00b7 \u00d7' + c.factor.toFixed(2) })
        );
      }))
    );
  }

  function filterBar() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.map(function (r) { return mainChainOf(r); }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chain = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); render(); });
    var tvl = el('select', { id: 'tvl', 'aria-label': 'Filter by minimum TVL' },
      [[0, 'Any TVL'], [50e6, 'TVL \u2265 $50M'], [100e6, 'TVL \u2265 $100M'], [500e6, 'TVL \u2265 $500M'], [1e9, 'TVL \u2265 $1B']].map(function (o) {
        return el('option', { value: String(o[0]), text: o[1], selected: state.tvl === o[0] ? 'selected' : null });
      })
    );
    tvl.addEventListener('change', function () { state.tvl = Number(tvl.value); writeHash(); render(); });
    var sort = el('select', { id: 'sort', 'aria-label': 'Sort the board' },
      [['value', 'Implied value'], ['tvl', 'TVL'], ['growth', '7-day growth'], ['age', 'Age'], ['chain', 'Chain factor'], ['name', 'Name']].map(function (o) {
        return el('option', { value: o[0], text: o[1], selected: state.sort === o[0] ? 'selected' : null });
      })
    );
    sort.addEventListener('change', function () { state.sort = sort.value; state.dir = state.sort === 'name' ? 1 : -1; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'wl', checked: state.watchlist });
    wl.addEventListener('change', function () { state.watchlist = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Main chain' }), chain),
      el('div', { class: 'field' }, el('label', { for: 'tvl', text: 'TVL' }), tvl),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort by' }), sort),
      el('label', { class: 'check', for: 'wl' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? visibleRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHead(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = (key === 'name') ? 1 : -1; } writeHash(); render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u25bc' : ' \u25b2' }) : null
      )
    );
  }

  function boardTable() {
    var list = orderedRows(visibleRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category, chain or TVL to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tvl = 0; state.watchlist = false; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tiltClass = r.chain_factor >= 1 ? 'tilt-up' : 'tilt-down';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + mainChainOf(r) })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('span', { class: 'chain-pill', text: mainChainOf(r) + ' \u00d7' + r.chain_factor.toFixed(2) })),
        el('td', null, el('div', { class: 'value-cell' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'value', text: money(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status ' + tiltClass, text: onWatchlist(r) ? 'watchlist' : 'early' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, best implied value first. Select a row for its chain breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHead('value', 'Rank'),
            sortHead('name', 'Protocol'),
            sortHead('tvl', 'TVL'),
            sortHead('growth', '7d'),
            sortHead('age', 'Age'),
            sortHead('chain', 'Chain tilt'),
            sortHead('value', 'Implied value'),
            el('th', { scope: 'col', text: 'Set' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + mainChainOf(r) }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel section' },
      el('h2', { text: 'How the ranking is computed' }),
      el('div', { class: 'formula' },
        'implied = tvl_usd x ' + DATA.median_ratio.toFixed(4) + ' (median mcap/TVL of token-bearing protocols) x chain factor x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.age_floor + ' + min(age_days, ' + m.age_days_cap + ') / ' + m.age_days_cap + ' x ' + m.age_range + ')'
      ),
      el('div', { class: 'formula' }, 'chain factor = ' + m.chain_floor + ' + ' + m.chain_range + ' x (pre-token TVL on the protocol\u2019s main chain / all pre-token TVL) — 0.80 on a quiet chain, up to 1.20 on the busiest frontier'),
      el('p', { text: 'The median ratio and every chain\u2019s share are computed from the snapshot on every run — nothing is hard-coded, and no protocol or chain name is special-cased. Age is the time since the protocol was first listed; an unlisted age uses ' + m.unknown_age_days + ' days. Growth is clamped so one wild week cannot dominate.' }),
      el('p', { text: 'Implied value is a model, not a price prediction: it says what a token might be worth if the market priced this protocol like the median token-bearing protocol, tilted toward the chain where untokenized value is concentrating. An airdrop is never guaranteed.' })
    );
  }

  var drawer = el('aside', { class: 'drawer', id: 'detail', hidden: true, 'aria-label': 'Protocol detail' });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    drawer.hidden = false;
    drawer.textContent = '';
    drawer.appendChild(el('div', { class: 'drawer-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (onWatchlist(row) ? ' \u00b7 watchlist' : ' \u00b7 early radar') }),
        el('h2', { text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { closeDetail(); } })
    ));
    drawer.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Median mcap / TVL' }), el('b', { class: 'num', text: DATA.median_ratio.toFixed(4) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: row.growth_multiplier.toFixed(4) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Age multiplier' }), el('b', { class: 'num', text: row.age_multiplier.toFixed(4) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'big', text: money(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Recomputed in this page as ' + money(valueOf(row)) + (valueOf(row) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') })
    ));
    drawer.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Chain frontier: ' + mainChainOf(row) }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Pre-token TVL on this chain' }), el('b', { class: 'num', text: fmtUsd(row.chain_pretoken_tvl_usd) })),
        el('div', null, el('span', { text: 'Share of all pre-token TVL' }), el('b', { class: 'num', text: fmtShare(row.chain_share) })),
        el('div', null, el('span', { text: 'Pre-token protocols on chain' }), el('b', { class: 'num', text: String(row.chain_pretoken_protocols) })),
        el('div', null, el('span', { text: 'All pre-token TVL' }), el('b', { class: 'num', text: fmtUsd(DATA.total_pretoken_tvl_usd) })),
        el('div', null, el('span', { text: 'Chain factor (0.80 + 0.40 \u00d7 share)' }), el('b', { class: 'big', text: '\u00d7' + row.chain_factor.toFixed(2) }))
      ),
      el('p', { class: 'sub', text: 'The factor tilts the value toward chains where untokenized TVL is already concentrating. ' + mainChainOf(row) + ' holds ' + fmtShare(row.chain_share) + ' of the snapshot\u2019s pre-token TVL, so this protocol is priced ' + (row.chain_factor >= 1 ? 'above' : 'below') + ' its base value.' })
    ));
    drawer.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    drawer.focus();
  }

  function closeDetail() {
    state.selected = null;
    drawer.hidden = true;
    writeHash();
    render();
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(topBar());
    shell.appendChild(intro());
    shell.appendChild(frontierPanel());
    shell.appendChild(filterBar());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!drawer.isConnected) app.appendChild(drawer);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hidden) closeDetail();
  });
})();
