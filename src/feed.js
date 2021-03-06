const request = require('request-promise-native');
const constants = require('./constants');
const auth = require('./auth');
const {Pin} = require('./models');

const current_window = require('electron').remote.getCurrentWindow();


module.exports = class Feed {
    constructor(uid='') {
        if (uid) {
            // this is feed on a user's profile page
            this.fetch_url = `${constants.PIN_URL}/${uid}/moments`;
            this.profile_url = `${constants.PROFILE_URL}/${uid}`;
        }
        else {
            // this is main timeline on index page
            this.fetch_url = constants.PIN_FETCH_URL;
            this.profile_url = constants.SELF_PROFILE_URL;
        }
        this.feed_offset = 0; // needed when fetching older feed
        this.local_latest_pin_id = '';
        this.server_latest_pin_id = '';
        this.local_latest_pin_time = 0;
        this.server_latest_pin_time = 0;
        this.local_oldest_pin_id = '';

        this.endCursor = '';
    }

    async start() {
        this._display_avatar();
        await this._fetch_initial_feed();
        this._enable_scroll_event();
    }

    async _display_avatar() {
        $('.self-avatar').attr('src', 'https://b-gold-cdn.xitu.io/v3/static/img/simplify-logo.3e3c253.svg');
    }

    async _fetch_initial_feed() {
        let res = await request({
            method: 'POST',
            url: 'https://web-api.juejin.im/query',
            headers: {
                'Content-Type': 'application/json',
                'X-Agent': 'Juejin/Web',
            },
            body: {
                'extensions': {
                    'query': {
                        'id': '249431a8e4d85e459f6c29eb808e76d0'
                    }
                },
                'variables': {'size': 20, 'after': ''}
            },
            jar: true,
            simple: false,
            json: true
        });

        let jsonData = res['data']['recommendedActivityFeed']['items']
        let nodeList = jsonData['edges']
        let pageInfo = jsonData['pageInfo']

        // $('.feed').append(JSON.stringify(nodeList));

        if (handle_err(res))
            return;
        // let pins_data = res['data'].filter((el) => el['type'] === 'moment');

        // get latest pin id & time
        // let pin = new Pin(pins_data[0]);
        // this.local_latest_pin_id = pin.id;
        // this.local_latest_pin_time = pin.time;
        //
        // this._report_latest_viewed_pin_id();
        // this._append_to_feed(pins_data);
        this.endCursor = pageInfo['endCursor']
        this._append_to_feed(nodeList);
    }

    _enable_scroll_event() {
        let container = $('.container');
        let self = this;
        container.scroll(async function() {
            let page_length = container[0].scrollHeight;

            let scroll_position = container.scrollTop();

            // scroll down to fetch older feed
            if (page_length - scroll_position < 3000) {
                // only send one fetch request
                container.off('scroll');
                await self._fetch_older_feed();
                self._enable_scroll_event();
            }
        });
    }

    async _fetch_older_feed() {
        let res = await request({
            method: 'POST',
            url: 'https://web-api.juejin.im/query',
            headers: {
                'Content-Type': 'application/json',
                'X-Agent': 'Juejin/Web',
            },
            body: {
                'extensions': {
                    'query': {
                        'id': '249431a8e4d85e459f6c29eb808e76d0'
                    }
                },
                'variables': {
                    'size': 20,
                    'after': this.endCursor
                },
            },
            jar: true,
            simple: false,
            json: true
        });

        if (handle_err(res))
            return;

        let jsonData = res['data']['recommendedActivityFeed']['items'];
        let nodeList = jsonData['edges'];
        let pageInfo = jsonData['pageInfo'];

        this.endCursor = pageInfo['endCursor']

        this._append_to_feed(nodeList);
    }

    async _check_update() {
        let res = await request({
            method: 'GET',
            url: this.fetch_url + '?reverse_order=0',
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (handle_err(res))
            return;
        let pin_data = res['data'].find((el) => el['type'] === 'moment');

        let pin = new Pin(pin_data);
        console.log(pin.id);
        if (
            pin.id !== this.local_latest_pin_id &&
            pin.time + 10 > this.local_latest_pin_time // 10 sec tolerance
        ) {
            this.server_latest_pin_id = pin.id;
            this.server_latest_pin_time = pin.time;

            // get the first pin, and fetch the rest in _fetch_update()
            let output = generate_pin_html(pin_data);
            this._fetch_update(pin.id, 0, output);
        }
    }

    async _fetch_update(fetch_after_id, fetch_offset, output) {
        console.log(fetch_offset);
        let stop_fetching = false;
        let res = await request({
            method: 'GET',
            url: this.fetch_url +
                 '?after_id=' + fetch_after_id + '&offset=' + fetch_offset,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (handle_err(res))
            return;
        let pins_data = res['data'].filter(el => el['type'] === 'moment');

        for (const pin_data of pins_data) {
            let pin = new Pin(pin_data);
            if (
                pin.id === this.local_latest_pin_id ||
                pin.time + 10 <= this.local_latest_pin_time
            ) {
                stop_fetching = true;
                break;
            }
            else {
                fetch_after_id = pin.id;
                output += generate_pin_html(pin_data);
            }
        }
        if (stop_fetching) {
            this.local_latest_pin_id = this.server_latest_pin_id;
            this.local_latest_pin_time = this.server_latest_pin_time;
            this._report_latest_viewed_pin_id();

            output = '<div id="update" class="hidden">' + output + '</div>';
            $('.feed').prepend(output);

            // give update 2 seconds to load
            setTimeout(
                () => {
                    let update = $('#update');
                    let container = $('.container');
                    let scroll_top = container.scrollTop();

                    update.removeClass('hidden');

                    // add spaces between CJK and half-width characters
                    pangu.spacingElementByClassName('text');

                    // maintain scroll bar position
                    container.scrollTop(scroll_top + update.outerHeight(true));

                    // remove outer .update div
                    update.children().unwrap();

                    // display feed update notification
                    $('#update-notification').addClass('notification-show');
                },
                2000
            );
        }
        else
            // make recursive call to fetch more update
            this._fetch_update(fetch_after_id, fetch_offset + 10, output);
    }

    _report_latest_viewed_pin_id() {
        request({
            method: 'POST',
            url: constants.PIN_VIEWS_REPORT_URL,
            headers: auth.get_authorized_request_header(),
            form: { 'pin_ids': this.local_latest_pin_id },
            simple: false,
            jar: true
        });
    }

    _append_to_feed(pins_data) {
        let output = '';
        for (const pin_data of pins_data)
            output += generate_pin_html(pin_data);
        $('.feed').append(output);

        // add spaces between CJK and half-width characters
        pangu.spacingElementByClassName('text');
    }
}


function generate_pin_html(pin_data) {
    let output = '';
    let pin = new Pin(pin_data);

    output += '<div class="pin" data-id="' + pin.id + '">';
    output += pin.get_html();
    output += '</div>'; // pin
    return output;
}

// return true if there is error in res
function handle_err(res) {
    if ('error' in res) {
        console.warn(res);
        if (res['error']['message'] === 'ERR_LOGIN_TICKET_EXPIRED') {
            // log out
            localStorage.clear();
            current_window.reload();
        }
        return true;
    }
    return false;
}
