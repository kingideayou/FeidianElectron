const request = require('request-promise-native');
const auth = require('./auth');
const constants = require('./constants');


class User {
    constructor(user_data) {
        this.id = user_data['id'];
        this.name = user_data['username'];
        this.bio = user_data['company'];
        // this.followers = user_data['follower_count'];
        // this.following = user_data['following_count'];
        // this.follows_me = user_data['is_followed'];
        // this.followed_by_me = user_data['is_following'];
        // this.num_pins = user_data['pins_count'];
        this.avatar = user_data['avatarLarge'].replace('_s', '_l');
        this.url = `${constants.PROFILE_WEB_URL}/${this.id}`;
    }

    get_avatar_html() {
        return `<a href="${this.url}">
                    <img class="avatar" src="${this.avatar}">
                </a>`;
    }

    get_name_html() {
        return `<a class="name" href="${this.url}">${this.name}</a>`;
    }

    get_html() {
        return this.get_avatar_html() + this.get_name_html();
    }

    is_self() {
        return (this.id === localStorage.getItem('self_user_id'));
    }

    static async follow(uid) {
        let res = await request({
            method: 'POST',
            url: `${constants.PROFILE_URL}/${uid}/followers`,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (res['is_following'])
            await User.update_profile(uid);
    }

    static async unfollow(uid) {
        let self_id = localStorage.getItem('self_user_id');
        let res = await request({
            method: 'DELETE',
            url: `${constants.PROFILE_URL}/${uid}/followers/${self_id}`,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (!res['is_following'])
            await User.update_profile(uid);
    }

    static async update_profile(uid) {
        let user;
        try {
            user = await User.get_user(uid);
        }
        catch (err) {
            console.warn(err);
            return;
        }

        $('.title').text(user.name);
        $('.profile > .author').html(user.get_html());
        $('.profile > .content').text(user.bio);
        // $('.followers .num').text(user.followers);
        // $('.following .num').text(user.following);
        // $('.num-pins .num').text(user.num_pins);

        // if (user.follows_me) {
        //     $('.follows-me').removeClass('hidden');
        //     $('.profile > .content').css({'margin-right': '135px'});
        // }
        // else {
        //     $('.follows-me').addClass('hidden');
        //     $('.profile > .content').css({'margin-right': '60px'});
        // }

        // let btn = $('.follow-btn');
        // if (user.followed_by_me) {
        //     btn.text('已关注');
        //     btn.addClass('followed-by-me');
        // }
        // else {
        //     btn.text('关注');
        //     btn.removeClass('followed-by-me');
        // }

        // btn.unbind('click');
        // btn.click(async function(event) {
        //     btn.fadeTo(200, 0);
        //     if (user.followed_by_me)
        //         await User.unfollow(uid);
        //     else
        //         await User.follow(uid);
        //     btn.fadeTo(200, 1);
        // });
    }

    static async get_user(uid) {
        let res = await request({
            method: 'GET',
            url: `${constants.PROFILE_URL}/${uid}`,
            headers: auth.get_authorized_request_header(),
            jar: true,
            json: true
        });
        return new User(res);
    }
}

class PinAuthor extends User {}

class Pin {
    constructor(pin_data) {
        let target = pin_data['node']['targets'][0] ? pin_data['node']['targets'][0] : pin_data;

        this.id = target['id'];
        this.author = new PinAuthor(target['user']);
        this.time = target['updatedAt'];
        this.num_likes = target['likeCount'];
        // this.is_liked = target['virtuals']['reaction_type'] === 'like';``
        this.is_liked = false;
        // this.num_repins = target['repin_count'];
        this.num_comments = target['commentCount'];
        this.text = '';
        this.images = [];
        this.video = '';

        let contents = target['content'];
        this.images.push(target['pictures']);
        this.text = contents;
        let url = target['url']
        if (url !== null && url !== '') {
            this.text += `<a class="link" href="${url}">${target['urlTitle']}</a>`;
        }

        // handle text & text repin
        // if (
        //     contents[0]['type'] === 'text' ||
        //     pin_data['feed_type'] === 'repin' ||
        //     pin_data['feed_type'] === 'repin_with_comment'
        // ) {
        //     this.text = contents[0]['content']
        //         .replace(/<script/ig, '')
        //         .replace(/data-repin=["'][^"']*["']/g, 'class="repin_user"') // mark repin
        //         .replace(/\sdata-[^=]+=["'][^"']*["']/g, '')
        //         .replace(/<\/a>:\s?/g, '</a>：') // use full-width colon
        //         .replace(/\s+class=["']member_mention["']/g, '')
        //         .replace('<br><a href="zhihu://pin/feedaction/fold/">收起</a>', '');
        //
            // const repin_sign = '<i class="fas fa-retweet"></i>';
            // const img_sign = '<i class="fas fa-image"></i>';

            // let links = this.text.match(
            //     /<a\s+(class=["'][^"']*["']\s+)?href=["'][^"']*["'](\s+class=["'][^"']*["'])?>/g);
            // links = new Set(links);
            // $('.feed').append(JSON.stringify(links));
            // for (const l of links) {
            //     // add repin sign before account names
            //     if (l.includes('repin_user'))
            //         this.text = this.text.split(l).join(repin_sign + l);
            //
            //     // add image sign before image links
            //     if (l.includes('comment_img') || l.includes('comment_sticker'))
            //         this.text = this.text.split(l).join(img_sign + l);
            // }
        // }

    }

    Linkify(inputText) {
        //URLs starting with http://, https://, or ftp://
        var replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
        var replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

        //URLs starting with www. (without // before it, or it'd re-link the ones done above)
        var replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
        var replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

        //Change email addresses to mailto:: links
        var replacePattern3 = /(\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,6})/gim;
        var replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

        return replacedText
    }

    get_statistics_html() {
        let output = '<div class="statistics">';
        if (this.author.is_self()) {
            // include delete button
            output += '<span class="delete-btn"><i class="fas fa-trash-alt"></i></span>';
        }
        output += `<span class="num-comments">
                   <i class="far fa-comment"></i>${this.num_comments}</span>`;
        // show solid heart if the pin is liked by the user; otherwise show regular heart
        output += `<span class="num-likes">
                   <i class="${this.is_liked ? 'fas' : 'far'} fa-heart"></i>${this.num_likes}
                   </span>`;
        output += '</div>'; // statistics
        return output;
    }
    _get_text_html() {
        return this.text ? `<div class="text">${this.text}</div>` : '';
    }
    _get_image_html() {
        let num_images = this.images.length;
        if (num_images === 0)
            return '';

        let output = '<div class="images">';

        if (num_images === 1)
            output += `<img class="img single-img" src="${this.images[0]}" data-index="0">`;
        else if (num_images === 2)
            for (const [index, url] of this.images.entries())
                output += `<div class="img double-img" data-url="${url}" data-index="${index}"
                            style="background-image: url('${url}');"></div>`;
        else {
            output += '<div class="img-grid"><div class="row">';
            for (const [index, url] of this.images.entries()) {
                output += `<div class="img" data-url="${url}" data-index="${index}"
                            style="background-image: url('${url}');"></div>`;
                // change to new row after every 3 images
                if (index > 1 && (index + 1) % 3 === 0)
                    output += '</div><div class="row">';
            }
            // remove the last <div class="row"> opening tag
            if (output.endsWith('<div class="row">'))
                output = output.slice(0, -17);
            else
                output += '</div>'; // row
            output += '</div>'; // img-grid
        }

        output += '</div>'; // images
        return output;
    }
    _get_video_html() {
        if (this.video === '')
            return '';
        return `<div class="video" data-url="${this.video}"
                data-width="${this.video_width}" data-height="${this.video_height}">
                <img class="thumbnail"
                src="${this.video_thumbnail ? this.video_thumbnail : constants.BLANK_THUMBNAIL}">
                <div class="far fa-play-circle"></div>
                </div>`;
    }
    get_content_html() {
        let output = '';
        output += this._get_text_html();
        output += this._get_image_html();
        output += this._get_video_html();
        return output;
    }
    get_html() {
        let origin_pin_html = '';
        if (this.is_repin) {
            origin_pin_html = this.origin_pin_deleted_reason ?
                `<div class="origin-pin">${this.origin_pin_deleted_reason}</div>`
                :
                `
                    <div class="origin-pin" data-id="${this.origin_pin.id}">
                        <div class="author">${this.origin_pin.author.get_name_html()}</div>
                        <div class="origin-pin-content">${this.origin_pin.get_content_html()}</div>
                    </div>
                `;
        }

        return `
            <div class="author">
                ${this.author.get_avatar_html()}
                ${this.author.get_name_html()}
            </div>
            <div class="time" data-time="${this.time}"></div>
            ${this.get_statistics_html()}
            <div class="content">
                ${this.get_content_html()}
                ${origin_pin_html}
                <div class="collapsed-indicator hidden">
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
        `;
    }

    static async delete(pin_id) {
        let res = await request({
            method: 'DELETE',
            url: constants.PIN_URL + '/' + pin_id,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (res['success'])
            $(`[data-id="${pin_id}"]`).remove();
    }

    static async like(pin_id) {
        let res = await request({
            method: 'POST',
            url: `${constants.PIN_URL}/${pin_id}/reactions?type=like`,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (res['success'])
            await Pin.update_statistics(pin_id);
    }

    static async unlike(pin_id) {
        let res = await request({
            method: 'DELETE',
            url: `${constants.PIN_URL}/${pin_id}/reactions`,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (res['success'])
            await Pin.update_statistics(pin_id);
    }

    static async update_statistics(pin_id) {
        let res = await request({
            method: 'GET',
            url: constants.PIN_URL + '/' + pin_id,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        let pin;
        try {
            pin = new Pin(res);
        }
        catch (err) {
            console.warn(res);
            return;
        }
        let selector = `.pin[data-id="${pin_id}"] > .statistics`;
        $(selector).replaceWith(pin.get_statistics_html());
    }

    static async get_html(pin_id) {
        let res = await request({
            method: 'GET',
            url: constants.PIN_URL + '/' + pin_id,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        let pin;
        try {
            pin = new Pin(res);
        }
        catch (err) {
            console.warn(res);
            return;
        }
        return pin.get_html();
    }

    static collapse(pin_id) {
        let pin = $(`.pin[data-id="${pin_id}"]`);
        let content = pin.children('.content');

        if (pin.outerHeight() < 350) {
            content.removeClass('collapse');
            setTimeout(() => content.css('max-height', 'none'), 300);
            return;
        }

        content.css('max-height', content.height());

        // maintain scroll position if pin is partially out of screen
        let container = $('.container');
        let scroll_top = container.scrollTop();
        let pin_h = pin.outerHeight(true);
        if (pin.offset().top < 0) {
            container.animate(
                {scrollTop: scroll_top - pin_h + 168}, 300, 'easieEaseOut');
        }

        content.addClass('collapse');
        content.children('.collapsed-indicator').removeClass('hidden');
    }

    static uncollapse(pin_id) {
        let pin = $(`.pin[data-id="${pin_id}"]`);
        let content = pin.children('.content');
        content.removeClass('collapse');
        setTimeout(() => {
            content.css('max-height', 'none');
            content.children('.collapsed-indicator').addClass('hidden');
        }, 300);
    }
}

class CommentAuthor extends User {
    constructor(data) {
        let user_data = data['member'];
        super(user_data);
    }
}

class Comment {
    constructor(comment_item) {
        this.id = comment_item['id'];
        this.time = comment_item['created_time'];
        this.content = comment_item['content']
            .replace(/\sdata-[^=]+=["'][^"']*["']/g, '');
        this.num_likes = comment_item['vote_count'];
        this.is_liked = comment_item['voting'];
        this.author = new CommentAuthor(comment_item['author']);
        if (comment_item['reply_to_author'])
            this.reply_to_author = new CommentAuthor(comment_item['reply_to_author']);

        // add image sign before image links
        const img_sign = ' <i class="fas fa-image"></i>';
        let links = this.content.match(
            /<a\s+(class=["'][^"']*["']\s+)?href=["'][^"']*["'](\s+class=["'][^"']*["'])?>/g);
        links = new Set(links);
        for (const l of links) {
            if (
                l.includes('comment_img') ||
                l.includes('comment_sticker') ||
                l.includes('comment_gif')
            )
                this.content = this.content.split(l).join(img_sign + l);
        }
    }

    get_html() {
        let output = '';
        output += `<div class="comment-item" data-id="${this.id}">
                   <div class="author">
                   <span class="comment-author">${this.author.get_html()}</span>`;
        if (this.reply_to_author) {
            output += `<i class="fas fa-long-arrow-alt-right arraw"></i>
                       <span class="comment-author">${this.reply_to_author.get_name_html()}</span>`;
        }
        output += '</div>'; // author
        // show solid heart if the comment is liked by the user; otherwise show regular heart
        output += `<div class="statistics"><span class="num-likes">
                   <i class="${this.is_liked ? 'fas' : 'far'} fa-heart"></i>${this.num_likes}
                   </span></div>`;
        output += `<div class="content">${this.content}</div>`;
        output += '</div>'; // comment-item
        return output;
    }

    static async like(comment_id) {
        let res = await request({
            method: 'POST',
            url: `${constants.COMMENT_URL}/${comment_id}/voters`,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (res['voting']) {
            // show solid heart
            let selector = `.comment-item[data-id="${comment_id}"] > .statistics > .num-likes`;
            $(selector).html(`<i class="fas fa-heart"></i>${res['vote_count']}`);
        }
    }

    static async unlike(comment_id) {
        let self_id = localStorage.getItem('self_user_id');
        let res = await request({
            method: 'DELETE',
            url: `${constants.COMMENT_URL}/${comment_id}/voters/${self_id}`,
            headers: auth.get_authorized_request_header(),
            jar: true,
            simple: false,
            json: true
        });
        if (!res['voting']) {
            // show regular heart
            let selector = `.comment-item[data-id="${comment_id}"] > .statistics > .num-likes`;
            $(selector).html(`<i class="far fa-heart"></i>${res['vote_count']}`);
        }
    }
}


module.exports = {User, Pin, Comment};
