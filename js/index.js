utils.ready(function () {
    var popup = utils.popup(),
        scene = document.querySelectorAll('.scene');

    if(!utils.isTouch()){
        popup.show('<span class="popup-inner">設備不支持！</span>');
        return;
    }

    function turnScene(index){
        for(var i=0; i<3; i++){
            if(i === index){
                scene[i].style.display = 'block';
                utils.addClass(scene[i], 'on');
            }else{
                scene[i].style.display = 'none';
                utils.removeClass(scene[i], 'on');
            }
        }
    }

    turnScene(0);

    utils.ajax({
        url: 'data.json',
        success: function(data){
            try{
                var html = '',
                    data = typeof data === 'object' ? data : JSON.parse(data);
                for(var i=0, len=data.length; i<len; i++){
                    html += '<div class="teams-item" data-id="'+data[i].id+'">' +
                            '<img class="teams-icon" src="'+data[i].img+'" alt="">' +
                            '<b class="teams-name">'+data[i].name+'</b>' +
                        '</div>';
                }
                document.getElementById('teams-list').innerHTML = html;
            }catch (e) {
                console.log(e);
            }
        },
        fail(){
            console.log('fail to request teams');
        }
    });

    var btn101 = document.getElementById('btn101'),
        ball201 = document.getElementById('ball201'),
        goalie = document.querySelectorAll('.goalie'),
        clock201 = document.getElementById('clock201'),
        score201 = document.getElementById('score201'),
        goal201 = document.getElementById('goal201'),
        pointer201 = document.getElementById('pointer201'),
        steer = document.getElementById('steer'),
        cv = document.getElementById('cv'),
        statTxt302 = document.getElementById('statTxt302'),
        goalie203Cls = goalie[2].className,
        kickAudio = new Audio(),
        requestFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame,
        cancelFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame,
        deg = 0,
        stat = 0, //守门员扑员状态，0:中间直站，1:左倾，2:右倾
        clock = null,
        timeLimit = 10000,
        countTime = timeLimit,
        sensitivity = .88,
        pscore = 0, //丢球
        uscore = 0, //进球
        speedY = [],
        speedX = [],
        pw202 = goalie[1].offsetWidth,
        pw203 = goalie[2].offsetWidth,
        gl = goal201.offsetLeft,
        gt = goal201.offsetTop,
        gw = goal201.offsetWidth,
        gh = goal201.offsetHeight,
        ballCenter = [],
        touchX = 0,
        touchY = 0,
        prevent = {passive: false};

    //用来阻止移动端浏览器默认的橡皮弹性，尤其iphone
    utils.addEvent(document.body, 'touchstart', function(e){
        if( ball201.parentNode.contains(e.target) && e.target !== ball201){
            e.preventDefault();
        }
    }, prevent);

    btn101.onclick = function(){
        kickAudio.src = 'audio/kick.mp3';
        kickAudio.play();
        turnScene(1);
        readyStart();
    };

    var setting = createSetting();

    function readyStart(){
        pscore = 0;
        uscore = 0;
        score201.innerText = '0';
        clock201.innerText = timeLimit/1000;
        countTime = timeLimit;
        utils.removeClass(pointer201, 'hide');

        var timeouter = setTimeout(function () {
            clearTimeout(timeouter);
            utils.popup({
                background: 'rgba(0,0,0,.7)',
                color: '#fff'
            }).show(setting);
        },1000);

        reStat();
    }

    function createSetting(){
        var div = document.createElement('div'),
            timeSelect = document.createElement('select'),
            sensSelect = document.createElement('select'),
            timeOption = [10,20,30,60],
            sensOption = [0.80,0.82,0.84,0.86,0.88,0.90,0.92,0.94,0.96,0.98],
            len = 0,
            i = 0;

        timeSelect.className = sensSelect.className = 'setting-select';
        div.className = 'popup-inner';

        timeSelect.onchange = function(){
            timeLimit = parseFloat(this.value)*1000;
            clock201.innerText = timeLimit/1000;
            countTime = timeLimit;
        };
        sensSelect.onchange = function(){
            sensitivity = parseFloat(this.value);
        };

        for(i=0,len=timeOption.length; i<len; i++){
            timeSelect.innerHTML += '<option style="color: #333;" value="'+timeOption[i]+'"'+(timeOption[i]===timeLimit/1000 ? 'selected' : '')+'>'+timeOption[i]+'秒</option>';
        }
        for(i=0,len=sensOption.length; i<len; i++){
            sensSelect.innerHTML += '<option value="'+sensOption[i]+'"'+(sensOption[i]===sensitivity ? 'selected' : '')+'>'+sensOption[i]+'</option>';
        }

        div.appendChild(document.createTextNode('挑戰時間：'));
        div.appendChild(timeSelect);
        div.appendChild(document.createElement('p'));
        div.appendChild(document.createTextNode('速度感應：'));
        div.appendChild(sensSelect);

        return div;
    }

    function reStat(){
        utils.addEvent(document, 'touchstart', touchStartFn, prevent);
        utils.addClass(goalie[0], 'on');
        utils.removeClass(goalie[1], 'on');
        goalie[2].className = goalie203Cls;
        goalie[1].removeAttribute('style');
        goalie[2].removeAttribute('style');
        ball201.removeAttribute('style');
    }

    function touchStartFn(e) {
        if(e.target !== ball201) return false;
        utils.removeEvent(document, 'touchstart', touchStartFn);
        e.preventDefault();

        speedY.splice(0, speedY.length);
        speedX.splice(0, speedX.length);

        utils.addClass(goalie[1], 'on');
        utils.removeClass(goalie[0], 'on');
        utils.removeClass(steer, 'transition-3');
        utils.addClass(steer, 'touch');

        touchX = e.targetTouches[0].clientX;
        touchY = e.targetTouches[0].clientY;
        pw202 = goalie[1].offsetWidth;
        pw203 = goalie[2].offsetWidth;
        gl = goal201.offsetLeft;
        gt = goal201.offsetTop;
        gw = goal201.offsetWidth;
        gh = goal201.offsetHeight;

        ballCenter[0] = ball201.offsetLeft + ball201.offsetWidth/2;
        ballCenter[1] = ball201.offsetTop + ball201.offsetHeight/2;

        utils.addEvent(document, 'touchmove', touchMoveFn, prevent);
        utils.addEvent(document, 'touchend', touchEndFn);
    }

    function touchMoveFn(e){
        e.preventDefault();
        touchX = e.targetTouches[0].clientX;
        touchY = e.targetTouches[0].clientY;

        if(touchX > gl+pw202/3 && touchX < gl+gw-pw202/3){
            goalie[1].style.left = touchX - pw202/2 + 'px';
            goalie[2].style.left = touchX - pw203/2 + 'px';
        }

        steer.style.transform = 'rotateZ('+(-Math.atan((touchX-ballCenter[0])/(touchY-ballCenter[1])) * 180 / Math.PI)+'deg)';

        speedX.push(touchX);
        speedY.push(touchY);
    }

    function touchEndFn(){
        utils.removeEvent(document, 'touchmove', touchMoveFn);
        utils.removeEvent(document, 'touchend', touchEndFn);

        if(speedX.length > 5) speedX.splice(0, speedX.length-5);
        if(speedY.length > 5) speedY.splice(0, speedY.length-5);

        var xSum = 0,
            ySum = 0,
            xLen = speedX.length,
            yLen = speedY.length,
            x,
            y;
        for(var i=1; i<xLen; i++){
            xSum += speedX[i] - speedX[i-1];
        }
        for(var j=1; j<yLen; j++){
            ySum += speedY[j] - speedY[j-1];
        }
        x = xSum/xLen;
        y = ySum/yLen;
        if(isNaN(x)) x = 0;
        if(isNaN(y)) y = 0;

        utils.addClass(goalie[2], 'on');
        utils.removeClass(goalie[0], 'on');
        utils.removeClass(goalie[1], 'on');
        utils.addClass(steer, 'transition-3');
        utils.removeClass(steer, 'touch');

        var rand1 = Math.random(), rand2 = Math.random();
        if(rand2 < .25){
            deg = 80;
        }else if(rand2 >= .25 && rand2 < .5){
            deg = 60;
        }else if(rand2 >= .5 && rand2 < .75){
            deg = 30;
        }else{
            deg = 0;
        }
        if(rand1 > .66){
            utils.addClass(goalie[2], 'jump-left-'+deg);
            stat = deg === 0 ? 0 : 1;
        }else if(rand1 < .33){
            utils.addClass(goalie[2], 'jump-right-'+deg);
            stat = deg === 0 ? 0 : 2;
        }else{
            stat = 0;
            deg = 0;
        }

        motion(x, y);

        kickAudio.pause();
        kickAudio.currentTime = 0;
        kickAudio.play();

        if(countTime === timeLimit) {
            clock = setInterval(clockFn, 1000);
            utils.addClass(pointer201, 'hide');
        }
    }

    function motion(x, y){
        var top = ball201.offsetTop,
            left = ball201.offsetLeft,
            width = ball201.offsetWidth,
            yLimit = top;

        utils.addClass(ball201, 'rotating');

        var timer = requestFrame(function re(){
            cancelFrame(timer);
            if(top <= 0 || y > -1){
                utils.removeClass(ball201, 'rotating');
                var bw = ball201.offsetWidth,
                    vW = ball201.parentNode.offsetWidth,
                    vH = ball201.parentNode.offsetHeight;
                //先判断球在球门区域
                if(left>gl && left<gl+gw-bw && top>gt && top<gt+gh-bw){
                    var ctx = cv.getContext('2d'),
                        binfo = ball201.getBoundingClientRect(),
                        pl = goalie[2].offsetLeft,
                        pt = goalie[2].offsetTop,
                        pw = goalie[2].offsetWidth,
                        ph = goalie[2].offsetHeight,
                        bimg = new Image(),
                        pimg = new Image(),
                        ox = pl+pw/2,
                        oy = pt+ph,
                        dir = stat === 1 ? -1 : 1,
                        pixs;

                    cv.width = vW;
                    cv.height = vH;

                    bimg.src = ball201.src;
                    pimg.src = goalie[2].src;

                    ctx.drawImage(bimg,binfo.left,binfo.top,bw,ball201.offsetHeight);
                    ctx.translate(ox, oy);
                    ctx.rotate(dir*Math.PI*deg/180);
                    ctx.translate(-ox,-oy);
                    ctx.globalCompositeOperation="source-in";
                    ctx.drawImage(pimg, pl, pt, pw,ph);

                    pixs = ctx.getImageData(gl, gt, gw, gh);
                    if(utils.noOpacity(pixs.data)){
                        pscore++;
                    }else{
                        uscore++;
                    }
                }else{
                    pscore++;
                }
                score201.innerText = uscore;

                timer = setTimeout( function(){
                    clearTimeout(timer);
                    reStat();
                    if(countTime === 0) gameOver(true);
                }, 200);
            }else{
                timer = requestFrame(re);
            }
            x *= sensitivity;
            y *= sensitivity;

            top += y;
            left += x;

            ball201.style.left = left + 'px';
            ball201.style.top = top + 'px';
            ball201.style.width = width * (top/yLimit) + 'px';
        });
    }

    function clockFn(){
        countTime -= 1000;
        if(countTime <= 0){
            clearInterval(clock);
            countTime = 0;
            clock201.innerText;
            gameOver();
        }else{
            clock201.innerText = countTime/1000;
        }
    }

    var score301 = document.getElementById('score301'),
        rank301 = document.getElementById('rank301'),
        again301 = document.getElementById('again301'),
        share301 = document.getElementById('share301');
    function gameOver(bool){
        if(!bool) turnScene(2);
        score301.innerText = uscore;
        rank301.innerText = '';
        if(uscore <= 0){
            statTxt302.src = 'img/p303.png';
        }else{
            statTxt302.src = 'img/p302.png';
        }
    }

    again301.onclick = function () {
        readyStart();
        turnScene(1);
    };

    var sharePopup = utils.popup({
        background: 'rgba(0,0,0,.7)',
        color: '#fff'
    });
    share301.onclick = function(){
        if(/MicroMessenger/i.test(window.navigator.userAgent)){
            sharePopup.show('<span class="popup-inner">請點擊微信右上角菜單選擇分享。</span>');
        }else{
            sharePopup.show('<span class="popup-inner">請點擊瀏覽分享菜單進行分享。</span>');
        }
    }

});


