const fs = require('fs');
const request = require('request');
const electron = require('electron');
const remote = electron.remote;
const shell = electron.shell;
const {app, dialog, BrowserWindow, Menu} = remote;
const Feed = require('./feed');
const {Pin} = require('./models');
const publish = require('./publish');
const constants = require('./constants');
const auth = require('./auth');

const current_window = remote.getCurrentWindow();

// ------------------------------------------------------------

// login & fetch initial feed
{
    let login_error = localStorage.getItem('login_error');
    if (login_error) {
        $('.login-error').text(login_error);
        localStorage.removeItem('login_error');
    }

    let feed = new Feed();
    let access_expire = localStorage.getItem('access_expire_time');
    if (access_expire < Date.now())
        log_in();
    else
        feed.start();

    function log_in() {
        $('.logo').addClass('hidden');
        auth.check_captcha();
        $('.login-form').removeClass('hidden');

        $('.login-btn').click(async function() {
            $(this).fadeTo(200, 0);
            let email = $('.email').val();
            let password = $('.password').val();
            let captcha_text = $('.captcha-text').val();
            await auth.get_access_token(email, password, captcha_text);
            feed.start();
        });
    }
}

// ------------------------------------------------------------

// check app update
{
    request(constants.GITHUB_CHECK_UPDATE_URL, function(error, response, body) {
        let latest_version = body;
        let current_version = app.getVersion();
        if (current_version !== latest_version) {
            let options = {
                title: '检查更新',
                buttons: ['去下载', '取消'],
                defaultId: 0,
                cancelId: 1,
                message: '当前版本 ' + current_version + '，' + 
                         '最新版本 ' + latest_version + '，要去下载吗？'
            };
            dialog.showMessageBox(current_window, options, function(response) {
                if (response === 0)
                    shell.openExternal(constants.GITHUB_DOWNLOAD_URL);
            });
        }
    });
}

// ------------------------------------------------------------

// update post time of each feed-item every second
{
    setInterval(function() {
        const now = Math.round(Date.now() / 1000);
        $('.time').each(function() {
            let time_field = $(this);
            let post_time = parseInt(time_field.attr('data-time'));
            time_field.text(get_relative_time_str(post_time, now));
        });
    }, 1000);

    const sec_per_min = 60;
    const sec_per_hour = sec_per_min * 60;
    const sec_per_day = sec_per_hour * 24;
    const sec_per_week = sec_per_day * 7;

    function get_relative_time_str(post_time, now) {
        let diff = now - post_time;
        if (diff < sec_per_min)
            return diff + ' 秒前';
        if (diff < sec_per_hour)
            return Math.round(diff / sec_per_min) + ' 分前';
        if (diff < sec_per_day )
            return Math.round(diff / sec_per_hour) + ' 时前';
        if (diff < sec_per_week)
            return Math.round(diff / sec_per_day) + ' 日前';
        // fall back to display full date
        let date = new Date(post_time * 1000);
        return date.getMonth() + ' 月 ' + date.getDate() + ' 日';
    }
}

// ------------------------------------------------------------

// update statistics of each feed-item every 10 min
{
    setInterval(function() {
        $('.feed-item').each(function() {
            Pin.update_statistics($(this).attr('data-id'));
        });
    }, constants.PIN_STATISTICS_UPDATE_INTERVAL);
}

// ------------------------------------------------------------

// click logo to publish new pin
{
    $('.logo').click(() => publish.open_editor());
}

// ------------------------------------------------------------

// click delete button to delete pin
{
    $(document).on('click', '.delete-btn', function(event) {
        let clicked_btn = $(this);
        let delete_menu = Menu.buildFromTemplate([
            {
                label: '删除',
                click: function() {
                    clicked_btn.fadeOut(200);
                    let pin_id = clicked_btn.parent().parent().attr('data-id');
                    Pin.delete(pin_id);
                }
            }
        ]);
        delete_menu.popup(current_window);
    });
}

// ------------------------------------------------------------

// click heart button to like pin
{
    $(document).on('click', '.num-likes', async function(event) {
        let clicked_btn = $(this);
        let pin_id = clicked_btn.parent().parent().attr('data-id');
        let is_liked = clicked_btn.find('i.fas.fa-heart').length !== 0;
        clicked_btn.fadeTo(200, 0);
        if (is_liked)
            await Pin.unlike(pin_id);
        else
            await Pin.like(pin_id);
        clicked_btn.fadeTo(200, 1);
    });
}

// ------------------------------------------------------------

// open pin details window
{
    // click feed item to add focus
    $(document).on('click contextmenu', '.feed-item', function(event) {
        let feed_item = $(this);

        // not trigger this event when clicking links or images
        if ($(event.target).is('a, a span, .img, .thumbnail'))
            return;

        if (!feed_item.hasClass('focus')) {
            $('.feed-item').removeClass('focus');
            feed_item.addClass('focus');
        }
    });

    // click title bar to remove focus
    $(document).on('click contextmenu', '.title-bar', function(event) {
        $('.feed-item').removeClass('focus');
    });

    // double click feed item to open comments window
    $(document).on('dblclick', '.feed-item', function(event) {
        // not trigger this event when clicking links or images
        if ($(event.target).is('a, a span, .img, .thumbnail'))
            return;

        let feed_item = $(this);
        open_comments_window(feed_item);
    });

    // right click on feed item to open comments window
    $(document).on('contextmenu', '.feed-item', function(event) {
        if ($(event.target).is('.img'))
            return;

        let feed_item = $(this);
        const feed_item_menu = Menu.buildFromTemplate([
            {
                label: '详情',
                click: () => open_comments_window(feed_item)
            }
        ]);
        feed_item_menu.popup(current_window);
    });

    function open_comments_window(feed_item) { // accept jQuery object
        window.getSelection().empty();
        feed_item.addClass('loading');

        let pin_id = feed_item.attr('data-id');
        let pin_html = feed_item.html();

        let win = new BrowserWindow({
            width: 450,
            minWidth: 400,
            maxWidth: 600,
            height: 800,
            titleBarStyle: 'hiddenInset',
            backgroundColor: "#333333",
            autoHideMenuBar: true,
            fullscreenable: false,
            show: false,
            useContentSize: true
        });
        win.loadFile('src/comments.html');
        win.webContents.on('did-finish-load', function() {
            // pass pin_id to comments window
            win.webContents.send('pin', pin_id, pin_html);

            feed_item.removeClass('loading');
            win.show();
        });
    }
}

// ------------------------------------------------------------

// click self avatar to open logout menu
{
    const logout_menu = Menu.buildFromTemplate([
        {
            label: '重载界面',
            click: () => current_window.reload()
        },
        {
            label: '意见反馈',
            click: () => shell.openExternal(constants.GITHUB_ISSUES_URL)
        },
        { type: 'separator' },
        {
            label: '登出知乎',
            click: () => {
                localStorage.clear();
                current_window.reload();
            }
        }
    ]);
    $(document).on('click', '.self-avatar', function(event) {
        logout_menu.popup(current_window);
    });
}

// ------------------------------------------------------------

// open links in external browser
{
    $(document).on('click', 'a[href^="http"]', function(event) {
        event.preventDefault();
        shell.openExternal(this.href, {activate: false});
    });
}

// ------------------------------------------------------------

// open timeline images
{
    // click to open images in new window
    $(document).on('click', '.img', function(event) {
        let img = $(this);

        // prevent opening window multiple times on double click
        if (img.hasClass('darkened'))
            return;

        // darken the image thumbnail while opening image window
        img.addClass('darkened');
        open_img_window(get_img_url(img).replace(/_[a-z]+/, '_qhd')); 
    });

    // right click context menu
    $(document).on('contextmenu', '.img', function(event) {
        let img_url = get_img_url($(this)).replace(/_[a-z]+/, '');
        let desktop_path = app.getPath('desktop') + '/';
        let file_name = Date.now() + '.jpg';
        const img_menu = Menu.buildFromTemplate([
            {
                label: '打开原图',
                click: () => {
                    $(this).addClass('darkened');
                    open_img_window(img_url);
                }
            },
            { type: 'separator' },
            {
                label: '保存原图到桌面',
                click: () =>
                    request(img_url).pipe(fs.createWriteStream(desktop_path + file_name))
            },
            {
                label: '保存原图到…',
                click: () => {
                    current_window.focus();
                    let path = dialog.showSaveDialog({
                        title: '保存原图',
                        defaultPath: file_name,
                        filters: [{ extensions: ['jpg'] }]
                    });
                    if (path)
                        request(img_url).pipe(fs.createWriteStream(path));
                }
            }
        ]);
        img_menu.popup(current_window);
    });

    function get_img_url(img_jquery) {
        if (img_jquery.hasClass('single-img'))
            return img_jquery.attr('src');
        else
            return img_jquery.css('background-image').slice(4, -1).replace(/"/g, "");
    }

    function open_img_window(img_url) {
        let img = new Image();
        img.src = img_url;
        img.onload = function() {
            let {win_w, win_h} = calculate_img_window_size(this.width, this.height);
            let win = new BrowserWindow({
                titleBarStyle: 'hidden',
                show: false,
                height: win_h,
                width: win_w,
                backgroundColor: "#000",
                autoHideMenuBar: true,
                fullscreenable: false,
                useContentSize: true
            });
            win.loadURL('data:text/html,' +
                        '<body style="-webkit-app-region: drag; margin: 0;">' +
                        '<img draggable="false" ' +
                        'width="' + win_w + '" height="auto" src="' + this.src + '">' +
                        '</body>');
            win.once('ready-to-show', () => {
                win.show();
                $('.img').removeClass('darkened');
            });
            win.on('closed', () => win = null);
        }
    }

    function calculate_img_window_size(img_w, img_h) {
        let current_screen = electron.screen.getDisplayMatching(current_window.getBounds());
        let screen_w = current_screen.workAreaSize.width;
        let screen_h = current_screen.workAreaSize.height;
        let max_w = Math.ceil(screen_w * 0.95);
        let max_h = Math.ceil(screen_h * 0.9);
        let output_w;
        let output_h;

        if (max_w < img_w || max_h < img_h) {
            let aspect_ratio = img_w / img_h;
            if (aspect_ratio <= 0.45) {
                // image is very tall; allow scroll in vertical direction
                output_w = Math.min(max_w, img_w);
                output_h = Math.ceil(output_w / aspect_ratio);
            }
            else {
                // normal aspect ratio; display entire image on screen
                output_h = Math.min(max_h, img_h);
                output_w = Math.ceil(output_h * aspect_ratio);

                if (output_w > screen_w) {
                    // image is very wide; adjust window size according to screen width
                    output_w = max_w;
                    output_h = Math.ceil(output_w / aspect_ratio);
                }
            }
        }
        else {
            output_w = img_w;
            output_h = img_h;
        }
        return {win_w: output_w, win_h: output_h};
    }
}

// ------------------------------------------------------------

// open timeline videos
{
    // open video in new window
    $(document).on('click', '.video .thumbnail', function(event) {
        let video = $(this).parent();

        // prevent opening window multiple times on double click
        if (video.hasClass('darkened'))
            return;

        video.addClass('darkened');

        let pin_id = video.parent().parent().attr('data-id');
        let video_url = video.attr('data-url');
        let width = parseInt(video.attr('data-width'));
        let height = parseInt(video.attr('data-height'));

        let player_win = new BrowserWindow({
            titleBarStyle: 'hidden',
            show: false,
            height: height,
            width: width,
            backgroundColor: "#000",
            autoHideMenuBar: true,
            useContentSize: true
        });
        player_win.loadFile('src/video_player.html');

        // pass video url to player window
        player_win.webContents.on('did-finish-load', function() {
            player_win.webContents.send('video', video_url, pin_id);
        });

        player_win.once('ready-to-show', function() {
            player_win.show();
            $('.video').removeClass('darkened'); // remove darkening
        });
    });
}
