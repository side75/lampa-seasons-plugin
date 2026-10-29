(function () {
    'use strict';

    function startPlugin() {
        if (window.lampa_seasons_badge_plugin) return;
        window.lampa_seasons_badge_plugin = true;

        var style = `<style id="seasons-plugin-style">
            .card__seasons {
                position: absolute;
                bottom: 0.5em;
                left: 0.5em;
                padding: 0.22em 0.55em;
                border-radius: 0.35em;
                font-size: 0.9em;
                font-weight: 700;
                z-index: 5;
                line-height: 1.15;
                letter-spacing: 0.02em;
                pointer-events: none;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
            }
            .card__seasons--airing {
                background: #df9a11;
                color: #111;
            }
            .card__seasons--completed {
                background: #469c76;
                color: #fff;
            }
        </style>`;
        $('body').append(style);

        var network = new Lampa.Reguest();
        var cache = Lampa.Storage.cache('seasons_cache_v3', 500, {});

        function getSeasonData(id, call) {
            if (cache[id] && (Date.now() - cache[id].time < 1000 * 60 * 60 * 12)) {
                return call(cache[id].data);
            }

            var url = Lampa.TMDB.api('tv/' + id + '?api_key=' + Lampa.TMDB.key() + '&language=' + Lampa.Storage.field('tmdb_lang', 'ru'));

            network.silent(url, function (json) {
                if (json && json.last_episode_to_air) {
                    var ep = json.last_episode_to_air;
                    var s_num = ep.season_number;
                    var e_num = ep.episode_number;
                    var total = 0;

                    if (json.seasons && json.seasons.length) {
                        json.seasons.forEach(function (s) {
                            if (s.season_number === s_num) total = s.episode_count;
                        });
                    }

                    var next_ep = json.next_episode_to_air;
                    var has_next_in_season = next_ep && next_ep.season_number === s_num;
                    var is_completed = (total > 0 && e_num >= total && !has_next_in_season) || json.status === 'Ended' || json.status === 'Canceled';

                    var result = {
                        season: s_num,
                        episode: e_num,
                        total: total,
                        completed: is_completed
                    };

                    cache[id] = { time: Date.now(), data: result };
                    Lampa.Storage.set('seasons_cache_v3', cache);
                    call(result);
                }
            });
        }

        function renderBadge(cardNode, data) {
            var card = $(cardNode);
            var view = card.find('.card__view');
            if (!view.length || view.find('.card__seasons').length) return;

            var cls = data.completed ? 'card__seasons--completed' : 'card__seasons--airing';
            var text = data.completed
                ? ('S' + data.season + ' ✓')
                : ('S' + data.season + ' ' + data.episode + (data.total ? '/' + data.total : ''));

            view.append('<div class="card__seasons ' + cls + '">' + text + '</div>');
        }

        function extractCardData(el) {
            if (!el) return null;
            if (el.card_data) return el.card_data;
            if (el.data) return el.data;
            for (var key in el) {
                if (el[key] && typeof el[key] === 'object') {
                    var obj = el[key];
                    if (obj.id && (obj.title || obj.name || obj.original_name)) return obj;
                    if (obj.data && obj.data.id) return obj.data;
                }
            }
            return null;
        }

        function processAllVisibleCards() {
            $('.card').each(function () {
                var el = this;
                if ($(el).find('.card__seasons').length) return;
                var item = extractCardData(el);
                if (item && (item.first_air_date || item.media_type === 'tv' || item.original_name || item.number_of_seasons)) {
                    getSeasonData(item.id, function (res) {
                        renderBadge(el, res);
                    });
                }
            });
        }

        if (window.Lampa && Lampa.Listener) {
            Lampa.Listener.follow('card', function (e) {
                if ((e.type === 'build' || e.type === 'visible' || e.type === 'create') && e.object) {
                    var item = e.data || e.object.data;
                    var html = e.object.render ? e.object.render() : e.element;
                    if (item && html && (item.first_air_date || item.media_type === 'tv' || item.original_name || item.number_of_seasons)) {
                        getSeasonData(item.id, function (res) {
                            renderBadge(html, res);
                        });
                    }
                }
            });

            Lampa.Listener.follow('line', function (e) {
                if (e.type === 'visible' || e.type === 'append') {
                    setTimeout(processAllVisibleCards, 150);
                }
            });

            Lampa.Listener.follow('activity', function (e) {
                if (e.type === 'start' || e.type === 'ready') {
                    setTimeout(processAllVisibleCards, 300);
                }
            });
        }

        setInterval(processAllVisibleCards, 1500);
        processAllVisibleCards();
    }

    if (window.appready) {
        startPlugin();
    } else if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    } else {
        setTimeout(startPlugin, 2000);
    }
})();
