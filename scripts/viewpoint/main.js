class LagrangeBuilder{
    constructor(){
        // 检查必要的 DOM 元素
        this.linearInputPanel = document.querySelector(".linearInput");
        this.customInputPanel = document.querySelector(".customInput");
        this.inputSwitcher = document.querySelector(".inputGroup fieldset");
        this.linearInputTitle = document.querySelector(".linearInputTitle");
        this.answerElement = document.querySelector(".answer");
        this.processButton = document.querySelector(".process");
        
        if (!this.linearInputPanel || !this.customInputPanel || !this.inputSwitcher || 
            !this.linearInputTitle || !this.answerElement) {
            console.error('LagrangeBuilder: 必要的 DOM 元素未找到');
            return;
        }
        
        this.toggleDarkMode();
        window.copy = this.copy;
        
        // 监听系统主题变化
        if (window.matchMedia) {
            try {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                    this.toggleDarkMode();
                });
            } catch (e) {
                console.warn('无法监听主题变化:', e);
            }
        }
        
        // 监听博客主题切换（如果存在）
        try {
            var themeObserver = new MutationObserver(() => {
                this.toggleDarkMode();
            });
            if (document.documentElement) {
                themeObserver.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['data-theme']
                });
            }
        } catch (e) {
            console.warn('无法监听主题切换:', e);
        }
        
        // 绑定输入切换事件
        if (this.inputSwitcher) {
            this.inputSwitcher.addEventListener("change", (e) => {
                if (e.target && e.target.name === 'inputForm') {
                    this.switchInputPanel(e.target.value); 
                }
            });
        }
        
        // 初始化线性输入
        this.initLinearInput();
    }
    /**
     * 构造拉格朗日插值多项式
     * @param {Array} points 插值点数组
     * @param {string} parame 插值参数名
     * @returns {string} 拉格朗日插值多项式
     */
    lagrangeInterpolation(points, param) {
        const terms = [];
        for (let i = 0; i < points.length; i++) {
            let term = String(points[i].y);
            for (let j = 0; j < points.length; j++) {
                if (i !== j) {
                    term += `*(${param}-${points[j].x})/(${points[i].x}-${points[j].x})`;
                }
            }
            terms.push(term);
        }
        return terms.join("+");
    }
    /**
     * 线性输入面板添加输入框
     */
    addLinearInput(element, value){
        if (!element || !this.linearInputPanel) {
            console.error('addLinearInput: 参数错误');
            return;
        }
        
        const input = document.createElement("input");
        input.type = "text";
        input.className = "linearInputItem";
        input.addEventListener("change", (e) => {
            this.linearInputChange(e);
        });
        input.addEventListener("input", (e) => {
            // 实时验证输入
            const val = e.target.value;
            if (val && val !== "?" && isNaN(val)) {
                e.target.classList.add("invalid");
            } else {
                e.target.classList.remove("invalid");
            }
        });
        
        if (value !== undefined && value !== null) {
            input.value = value;
        }
        
        try {
            element.before(input);
        } catch (e) {
            // 如果 before 不支持，使用 insertBefore
            this.linearInputPanel.insertBefore(input, element);
        }
    }
    /**
     * 线性输入面板变化时事件
     */
    linearInputChange(e){
        //判断当前输入值是否合法
        //只有数字和?是合法的
        const value = e.target.value;
        const element = e.target;
        if(isNaN(value)&&value!="?"){
            element.placeholder = value;
            element.value = "";
            element.classList.add("invalid");
        }else{
            element.placeholder = "";
            element.classList.remove("invalid");
        }
        const values = this.getLinearInputValues();
        if(values.includes("?")){
            this.linearInputTitle.innerText = "找规律";
        }else{
            this.linearInputTitle.innerText = "拉格朗日插值"; 
        }
        if(values.join("").split("?").length>2){
            Swal.fire({
                title: "错误",
                text: "输入错误，最多只能有一个问号",
                icon: "error",
                confirmButtonText: "确定"
            });
            element.placeholder = value;
            element.value = "";
            element.classList.add("invalid");
            return
        }
    }
    /**
     * 获取所有线性输入框的值
     * @returns {Array} 所有线性输入框的值
     */
    getLinearInputValues(){
        const inputs = document.querySelectorAll(".linearInputItem");
        const values = [];
        inputs.forEach((input)=>{
            values.push(input.value);
        });
        return values;
    }
    /**
     * 初始化输入面板的输入框和数据
     */
    initLinearInput(){
        if (!this.linearInputPanel) {
            console.error('linearInputPanel 未找到');
            return;
        }
        
        // 清空现有内容（防止重复初始化）
        this.linearInputPanel.innerHTML = '';
        
        const button = document.createElement("input");
        button.type = "button";
        button.value = "+";
        button.className = "outline secondary";
        button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.addLinearInput(button);
        });
        this.linearInputPanel.appendChild(button);
        
        const data = [2, 3, 4, 5, "?", 6];
        for (let i = 0; i < data.length; i++) {
            this.addLinearInput(button, data[i]); 
        }
    }
    /**
     * 切换输入面板
     */
    switchInputPanel(value){
        switch(value){
            case "linearInput":
                this.linearInputPanel.style.display = "flex";
                this.customInputPanel.style.display = "none";
                this.linearInputTitle.style.display = "block";
                break;
            case "customInput":
                this.linearInputPanel.style.display = "none";
                this.customInputPanel.style.display = "block";
                this.linearInputTitle.style.display = "none";
                break;
        }
    }
    hidePartRecursion(_in_parts,_out_partsRestore){
        const part = _in_parts.pop();
        part.setAttribute("data-display",part.style.display);
        part.style.display = "none";
        _out_partsRestore.push(part);
        if(_in_parts.length>0){
            this.hidePartRecursion(_in_parts,_out_partsRestore);
        }
    }
    showPartRecursion(parts){
        const part = parts.pop();
        part.style.display = part.getAttribute("data-display");
        window.scrollTo(0, document.body.scrollHeight);
        if(parts.length>0){
            setTimeout(()=>{
                this.showPartRecursion(parts);
            },30);
        }else{
            this.processButton.setAttribute("aria-busy","false");
            this.processButton.innerHTML = "求解";
        }
    }
    /**
     * 解析自定义输入
     */
    parseCustomInput(){
        const input = document.querySelector(".customInput textarea").value;
        const arr = input.split(" ");
        const points = {};
        for(let i=0;i<arr.length;i++){
            const item = arr[i];
            const point = item.split(',');
            if(point.length!=2||isNaN(point[1])){
                Swal.fire({
                    title: "错误",
                    text: "输入非法",
                    icon: "error",
                    confirmButtonText: "确定"
                });
                return null;
            }
            points[point[0]]=point[1];
        }
        const fpoints = [];
        for(let key in points){
            fpoints.push({
                x:key,
                y:points[key]
            });
        }
        return fpoints;
    }
    /**
     * 开始运算
     */
    async process(){
        const inputPanel = document.querySelectorAll(".inputGroup fieldset input");
        let switcher = "";
        for(let i=0;i<inputPanel.length;i++){
            if(inputPanel[i].checked){
                switcher = inputPanel[i].value;
                break;
            }
        }

        if(switcher==="customInput"){
            const points = this.parseCustomInput();
            if(!points){
                return;
            }
            this.processPromptly(points);
            return; 
        }
        if(switcher==="linearInput"){
            const points = await this.getPoints();
            if(!points){
                return; 
            }
            this.processWithsteps(points); 
        }
    }
    copy(str){
        const el = document.createElement('textarea');
        el.value = str;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        Swal.fire({
            title: "复制成功",
            text: str,
            icon: "success", 
        })
    }
    /**
     * 显示过程的求解
     */
    processWithsteps(points){
        this.processButton.setAttribute("aria-busy","true");
        this.processButton.innerHTML = "求解中...";
        
        const polynomial = this.lagrangeInterpolation(points,'x');
        const simplify = math.simplify(polynomial);
        const latexHtml = katex.renderToString("f(x)="+simplify.toTex(),{
            throwOnError: false,
            displayMode: true,
            output: "mathml"
        });
        //组装答案
        let html="";
        html += "<p>注意到，当</p>";
        html += latexHtml;
        html += `<span class="btn">
            <button onclick="copy('f(x)=${simplify.toTex()}')" class="secondary">复制Latex</button>
            <button onclick="copy('f(x)=${simplify.toString()}')" class="secondary">复制表达式</button>
        </span>`
        html += "<p>时，有</p>";
        html += "<p><span>";
        for(let i=0;i<points.length;i++){
            const x = points[i].x;
            html += katex.renderToString(`f(${x})=${math.evaluate(polynomial, {x})}`,{
                throwOnError: false,
                output: "mathml"
            }); 
        }
        html += "</span></p>";
        if(this.correctValue){
            html += "<p>所以正确答案是</p>";
            html += `<span class="answerValue">${this.correctValue}</span>`; 
        }
        this.correctValue = null;

        //显示答案和动画
        this.answerElement.innerHTML = html;

        const parts = Array.from(this.answerElement.querySelectorAll("*")).filter((part)=>{
            return part.children.length===0;
        });
        const partsRestore = [];
        this.hidePartRecursion(parts,partsRestore);
        this.showPartRecursion(partsRestore);
    }
    /**
     * 不显示过程的求解
     */
    processPromptly(points){
        const polynomial = this.lagrangeInterpolation(points,'x');
        const simplify = math.simplify(polynomial);
        const latexHtml = katex.renderToString("f(x)="+simplify.toTex(),{
            throwOnError: false,
            displayMode: true,
            output: "mathml"
        });
        let btmHtml = `<span class="btn">
            <button onclick="copy('f(x)=${simplify.toTex()}')" class="secondary">复制Latex</button>
            <button onclick="copy('f(x)=${simplify.toString()}')" class="secondary">复制表达式</button>
        </span>`
        this.answerElement.innerHTML = latexHtml+btmHtml;
    }
    /**
     * 获取点对象
     * @returns {Array} 点对象数组
     */
    async getPoints(){
        const points = [];
        const values = this.getLinearInputValues();

        for(let i=0;i<values.length;i++){
            if(values[i]==="?"){
                const value = await this.askQuestion();
                if(!value){
                    return null;
                }
                this.correctValue = value;
                points.push({x:i,y:value});
            }else if(values[i]!==""){
                points.push({x:i,y:values[i]}); 
            }
        }
        return points;
    }
    /**
     * 询问?的值
     */
    askQuestion(){
        return new Promise((resolve,reject)=>{
            Swal.fire({
                title: "你希望?的值是多少?",
                input: "number",
                confirmButtonText: "确认",
                inputAttributes: {
                    style: "width: 20rem;margin: 1rem auto;", 
                }
            })
            .then((result) => {
                if (!result.isConfirmed) {
                    resolve(null);
                    return;
                }
                resolve(result.value);
            });
        }) 
    }
    /**
     * 切换sweetalert主题 - 适配博客暗色模式
     */
    toggleDarkMode() {
        // 检查博客主题的暗色模式
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' || 
                          window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if(isDarkMode){
            if(window.darkMode){
               return; 
            }
            // 使用博客主题的暗色模式，不需要额外加载 dark.css
            // SweetAlert2 会自动适配暗色模式
            window.darkMode = true;
        }else{
           if(window.darkMode){
                window.darkMode = false;
           }
        }
    }
}

// 确保所有依赖都已加载后再初始化
(function initLagrangeBuilder() {
    var isInitializing = false;
    var isInitialized = false;
    
    function init() {
        // 防止重复初始化
        if (isInitializing || isInitialized) {
            return isInitialized;
        }
        
        // 检查页面元素是否存在
        if (!document.querySelector('#viewpoint')) {
            return false;
        }
        
        // 检查必要的全局对象是否已加载
        // sweetalert2 可能暴露为 Swal 或 Sweetalert2
        var hasSwal = typeof Swal !== 'undefined' || typeof Sweetalert2 !== 'undefined';
        if (typeof math === 'undefined' || typeof katex === 'undefined' || !hasSwal) {
            console.log('等待依赖加载 - math:', typeof math, 'katex:', typeof katex, 'Swal:', typeof Swal, 'Sweetalert2:', typeof Sweetalert2);
            return false;
        }
        
        // 如果只有 Sweetalert2，创建 Swal 别名
        if (typeof Swal === 'undefined' && typeof Sweetalert2 !== 'undefined') {
            window.Swal = window.Sweetalert2;
        }
        
        // 如果已经初始化过，不再重复初始化
        if (window.lb) {
            isInitialized = true;
            return true;
        }
        
        isInitializing = true;
        
        // 所有依赖已加载，直接初始化
        try {
            const lb = new LagrangeBuilder();
            window.lb = lb;
            
            // 绑定按钮点击事件（使用事件委托）
            var controller = document.querySelector('.controller');
            if (controller) {
                // 使用事件委托，避免重复绑定
                controller.addEventListener('click', function(e) {
                    if (e.target && (e.target.classList.contains('process') || e.target.getAttribute('data-action') === 'process')) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.lb && typeof window.lb.process === 'function') {
                            try {
                                window.lb.process();
                            } catch (err) {
                                console.error('处理求解时出错:', err);
                            }
                        } else {
                            console.error('LagrangeBuilder 未初始化或 process 方法不存在');
                        }
                    }
                }, false);
            } else {
                console.warn('未找到 controller 容器');
            }
            
            isInitializing = false;
            isInitialized = true;
            console.log('LagrangeBuilder 初始化成功');
            return true;
        } catch (error) {
            isInitializing = false;
            console.error('LagrangeBuilder 初始化失败:', error);
            console.error('错误堆栈:', error.stack);
            return false;
        }
    }
    
    function startInit() {
        var retryCount = 0;
        var maxRetries = 100;
        var checkAndInit = function() {
            retryCount++;
            if (init()) {
                return; // 初始化成功
            }
            if (retryCount < maxRetries) {
                setTimeout(checkAndInit, 100);
            } else {
                console.error('LagrangeBuilder 依赖加载超时，请检查脚本是否正确加载');
                console.log('当前状态 - math:', typeof math, 'katex:', typeof katex, 'Swal:', typeof Swal, 'Sweetalert2:', typeof Sweetalert2);
                console.log('请检查以下脚本是否正确加载:');
                console.log('1. /scripts/viewpoint/math.js');
                console.log('2. /scripts/viewpoint/katex.min.js');
                console.log('3. /scripts/viewpoint/sweetalert2@11.js');
                console.log('4. /scripts/viewpoint/main.js');
            }
        };
        checkAndInit();
    }
    
    // 如果 DOM 已加载完成，直接尝试初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startInit);
    } else {
        // DOM 已加载，直接尝试初始化
        startInit();
    }
    
    // 处理 pjax 重新加载（如果启用了 pjax）
    if (typeof window.pjax !== 'undefined' && window.pjax) {
        document.addEventListener('pjax:complete', function() {
            if (window.location.pathname.includes('/viewpoint/')) {
                isInitialized = false;
                isInitializing = false;
                window.lb = null;
                startInit();
            }
        });
    }
})();

