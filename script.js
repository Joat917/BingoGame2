(()=>{

// board size init
const rows = 13;
const cols = 13;
let cellWidth=50;
if(window.matchMedia('(min-width: 353px) and (max-width: 650px)').matches){
    cellWidth=27;
}

// setting data
let thing_cata_enabled = [1, 2, 3, 4, 5]; // available catagories. Must be subset of (1,2,3,4,5). 
let generator_corr_length = 2; // average times of repeating the previous catagory of generated things. The larger this value, the easier to bingo. Cannot be less than 1.0 
let movement_acc = 1e-3; // acceleration of movement, 50px per 10ms^2
let movement_v0= 5e-2; // initial velocity of movement, 50px per 10ms
let layout_number=5; // type of layout. 1: normal; 2: convection; 3: circling; 4: core; 5: chaos
let swap_time_estimate=1000; // estimated time of single_cell movement, in milliseconds
let _swap_cooling_down=0;
let _step_overflow=false;
let local_storage_enabled=false;
const refresh_swap_time_estimate=(()=>{
    // vt+1/2 at^2==1
    const v=movement_v0; const a=movement_acc;
    swap_time_estimate=Math.ceil((-v+Math.sqrt(v*v+2*a))/a)*10+10;
    return swap_time_estimate;
}) 
refresh_swap_time_estimate(); 

let gameOn=0;
let total_steps=15;
let difficulty_coeff=1;
const calculate_difficulty_coeff=()=>{
    difficulty_coeff=1;
    switch(thing_cata_enabled.length){
        case 2:
            difficulty_coeff*=100;
            break;
        case 3:
            difficulty_coeff*=10;
            break;
        case 4:
            difficulty_coeff*=1.2;
    }
    difficulty_coeff*=1+0.1*generator_corr_length;
    difficulty_coeff*=(total_steps+5)/20;
    if(layout_number===2){difficulty_coeff*=4;}
    return difficulty_coeff;
}


// board data array init
const board_enabled = [];  // things can only get into enabled cells
const board_contents = [];  // mark which cells are being occupied. Occupied cells may be empty because their hosts are on their way there. 
const board_things = [];  // Host things of the cells. When the host is not home, the element is undefined. 
const board_reset=()=>{
    // clear data
    board_contents.splice(0);
    for(const th_row of board_things){
        for(const th of th_row){
            if(th!==undefined && th.ele!==undefined){
                th.ele.remove();
            }  
        }
    }
    board_things.splice(0);
    board_enabled.splice(0);
    // fill with empty data
    for (let row = 0; row < rows; row++) {
        const ct_row = [];
        const th_row = [];
        const be_row = [];
        for (let col = 0; col < cols; col++) {
            ct_row.push(0);
            th_row.push(undefined);
            switch(layout_number){
                case 1:
                    be_row.push(true);
                    break;
                case 2:
                    be_row.push(!((row==0&&col%2==1)||(row==rows-1&&col%2==0)))
                    break;
                case 3:
                    be_row.push(row<3||row>=rows-3||col<3||col>=cols-3);
                    break;
                case 4:
                    be_row.push(row!==6||col!==6);
                    break;
                case 5:
                    be_row.push(Math.random()<0.8);
                    break;
            }
        }
        board_contents.push(ct_row);
        board_things.push(th_row);
        board_enabled.push(be_row);
    }

    // change difficulty
    calculate_difficulty_coeff();

    // change element status
    try{
        arr_ele_board_row;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const ele_cell = arr_ele_board_cell[row][col];
                if(!board_enabled[row][col]){
                    ele_cell.classList.add('disabled');
                }else{
                    ele_cell.classList.remove('disabled');
                }
            }         
        }
    }catch{}
};
board_reset();


// utility functions
const init_2d_array=(arr, fill = undefined)=>{
    arr.splice(0);
    for (let row = 0; row < rows; row++) {
        let line = [];
        for (let col = 0; col < cols; col++) {
            line.push(fill);
        }
        arr.push(line);
    }
    return arr;
} // clear and fill a 2D array
function* all_places() {
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            yield [+row, +col];
        }
    }
    return;
} // a generator that yields all places in the board
function legal_pos(pos) {
    return (pos[0] >= 0 && pos[0] < rows && pos[1] >= 0 && pos[1] < cols && board_enabled[pos[0]][pos[1]]);
} // positions that things can enter
function random_cata(){
    return thing_cata_enabled[Math.floor(Math.random() * thing_cata_enabled.length)];
} // obtain a random catagory that is enabled
function acquire_thing(row, col) {
    if(legal_pos([row, col])){
        return board_things[row][col];
    }
    return undefined;
} // acquire a thing from board thing array
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}// shuffle an array


// Slider class script
const sliders=[];
class Slider{
    constructor(parentEle, eta2valueMap=undefined, initEta=0, title=''){
        this.ele=document.createElement('div');
        this.ele.classList.add('slider');
        parentEle.append(this.ele);
        this.ele_title=document.createElement('div');
        this.ele_title.classList.add('slider_title');
        this.ele_title.innerText=title;
        this.ele.append(this.ele_title);
        this.ele_container=document.createElement('div');
        this.ele_container.classList.add('slider_container');
        this.ele.append(this.ele_container);
        this.ele_thumb=document.createElement('div');
        this.ele_thumb.classList.add('slider_thumb');
        this.ele_container.append(this.ele_thumb);
        this.ele_value=document.createElement('div');
        this.ele_value.classList.add('slider_value');
        this.ele_value.textContent=eta2valueMap(initEta);
        this.ele.append(this.ele_value);
        this.eta=initEta;
        this.eta2valueMap=eta2valueMap;
        this.isDragging=false;
        this.enabled=true;

        // Attach event listeners after defining functions
        this.ele_thumb.addEventListener('mousedown', (e)=>this.onMouseDown(e));
        this.ele_container.addEventListener('mousemove', (e)=>this.onMouseMove(e));
        document.addEventListener('mouseup', (e)=>this.onDragEnd(e));

        this.ele_thumb.addEventListener('touchstart', (e)=>this.onTouchStart(e));
        this.ele_container.addEventListener('touchmove', (e)=>this.onTouchMove(e));
        document.addEventListener('touchend', (e)=>this.onDragEnd(e));

        this.updateSliderValue();
        sliders.push(this);
    }

    updateSliderPosition(x){
        x=x-this.ele_container.getClientRects()[0].x-this.ele_thumb.offsetWidth/2;
        x = Math.max(0, Math.min(this.ele_container.offsetWidth - this.ele_thumb.offsetWidth, x));
        this.eta = (x / (this.ele_container.offsetWidth - this.ele_thumb.offsetWidth));
        this.updateSliderValue();
    }

    updateSliderValue() {
        this.ele_thumb.style.left = `${this.eta*(this.ele_container.offsetWidth - this.ele_thumb.offsetWidth)}px`;
        const value=this.eta2valueMap(this.eta);
        this.ele_value.textContent = value;
    }

     onMouseDown(e) {
        if(!this.enabled)return;
        this.isDragging = true;
        this.updateSliderPosition(e.clientX);
    }

     onTouchStart(e) {
        if(!this.enabled)return;
        this.isDragging = true;
        e.preventDefault();
        this.updateSliderPosition(e.touches[0].clientX);
    }

     onMouseMove(e) {
        if (!this.isDragging) return;
        this.updateSliderPosition(e.clientX);
    }

     onTouchMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        this.updateSliderPosition(e.touches[0].clientX);
    }

     onDragEnd(e) {
        e.preventDefault();
        this.isDragging = false;
    }

    enable(){
        this.enabled=true;
        this.ele_thumb.classList.remove('disabled');
    }

    disable(){
        this.enabled=false;
        this.isDragging=false;
        this.ele_thumb.classList.add('disabled');
    }
}


// acquire and generate board elements
const ele_board_container = document.querySelector('.board_container');
const ele_task_panel_container=document.querySelector('.task_panel_container');
const ele_setting_page=document.querySelector('.setting_page');
const ele_mask=document.querySelector('.mask');
const ele_ending_page=document.querySelector('.ending_page');
const ele_start_game_button=document.querySelector('.start_game_button');
const ele_settings_button=document.querySelector('.settings_button');
const ele_setting_silders=document.querySelector('.setting_sliders');
const ele_ending_caption=document.querySelector('#ending_caption');
const ele_ending_tasks=document.querySelector('#ending_tasks');
const ele_ending_stars=document.querySelector('#ending_stars');
const ele_restart_button=document.querySelector('#restart_button');
const arr_ele_board_row = [];
const arr_ele_board_cell = [];
for (let row = 0; row < rows; row++) {
    // generate row element
    const ele_row = document.createElement('div');
    ele_row.classList.add('board_row');
    ele_board_container.append(ele_row);
    arr_ele_board_row[row] = ele_row;
    arr_ele_board_cell[row] = [];
    // generate cell elements
    for (let col = 0; col < cols; col++) {
        const ele_cell = document.createElement('div');
        ele_cell.classList.add('board_cell');
        // put the cell into board
        ele_row.append(ele_cell);
        arr_ele_board_cell[row][col] = ele_cell;   
    }         
}

// generate setting elements
const setting_cata_number=new Slider(ele_setting_silders, (x)=>{
    if(x<0.25){
        thing_cata_enabled=shuffle([1,2,3,4,5]).splice(5-2).sort();
        return 2;
    }else if(x<0.5){
        thing_cata_enabled=shuffle([1,2,3,4,5]).splice(5-3).sort();
        return 3;
    }else if(x<0.75){
        thing_cata_enabled=shuffle([1,2,3,4,5]).splice(5-4).sort();
        return 4;
    }else{
        thing_cata_enabled=[1,2,3,4,5];
        return 5;
    }
}, 1, 'Catagories');
const setting_layout_number=new Slider(ele_setting_silders, (x)=>{
    const value=Math.floor(x*4.999)+1;
    layout_number=value;
    switch(value){
        case 1:return 'Normal';
        case 2:return 'Convection';
        case 3:return 'Circling';
        case 4:return 'Core';
        case 5:return 'Random';
        default: return 'Unknown';
    }
}, 0, 'LayoutType');
const setting_total_steps=new Slider(ele_setting_silders, (x)=>{
    const value=Math.floor(x*30)+5;
    total_steps=value;
    return value;
}, 0.34, 'TotalSteps');
const setting_corr_length=new Slider(ele_setting_silders, (x)=>{
    let value=1/(1-x*0.9);
    value=Math.round(value*10)/10;
    generator_corr_length=value;
    return value;
}, 0.5, 'AvRepeat');
const setting_movement_acc=new Slider(ele_setting_silders, (x)=>{
    const value=[1e-4, 2e-4, 3.5e-4, 5e-4, 1e-3, 1.5e-3, 2e-3, 5e-3][Math.min(Math.floor(x*8),7)];
    movement_acc=value;
    refresh_swap_time_estimate();
    return value.toExponential(1); 
}, 0.55, 'Acceleration');
const setting_movement_v0=new Slider(ele_setting_silders, (x)=>{
    const value=[0, 5e-4, 1e-3, 1e-2, 5e-2, 1e-1, 2e-1][Math.min(Math.floor(x*7),6)];
    movement_v0=value;
    refresh_swap_time_estimate();
    return value.toExponential(1);
}, 0.64, 'InitVelocity');



// clock emoji obtain
const oclocks=['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'];
const hclocks=['🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'];
const obtain_clock_emoji=()=>{
    const date=new Date();
    const th=date.getHours();
    const tm=Math.floor(date.getMinutes()/30);
    if(tm){
        return hclocks[(th+11)%12];
    }else{
        return oclocks[(th+11)%12];
    }
} // obtain the corresponding clock emoji based on current time      


// overall movement control: when movements start or end and what to do then
let flowing = 0; // counts of moving things. This varible is reduced to zero iff no moving things are present on the board, therotically. 
const callbacks_flowing_vanish=[]; // functions to be called once flowing vanishes. Only the last function in this array is to be called. 
let _last_check_flowing=false; // for the checker to check if the flowing is not down previously but down now. 
setInterval(()=>{
    if(flowing>0){
        _last_check_flowing=true;
    }else{
        if(_last_check_flowing){
            _last_check_flowing=false;
            // console.log('flowing ends');
            // call the functions
            if(callbacks_flowing_vanish.length!==0){
                setTimeout(callbacks_flowing_vanish.pop(), 3000);
            }
            callbacks_flowing_vanish.splice(0);
        }
        flowing=0;
    }
}, 20); // check periodically

// mark the startpoint of dragging to swap using mouse. Used only in 'swap' function in class Things. 
const dragStart = {
    row: NaN,
    col: NaN
};

// the flowing logics of the grid, to be modified
class Connections {
    constructor() {
        this._last_places = init_2d_array([]);
        this._next_places = init_2d_array([]);
        this.generate_buffer = [];
        this.init();
    }

    init() {
        for (let pos0 of all_places()) {
            let [row, col] = pos0;
            let next_place_arr = [];
            let last_place_arr = [];
            this._next_places[row][col] = next_place_arr;
            this._last_places[row][col] = last_place_arr;

            if (!legal_pos(pos0)) {
                continue;
            }

            for (let pos2 of this._next_neighbors(pos0[0], pos0[1])) {
                if (legal_pos(pos2)) {
                    next_place_arr.push(pos2);
                }
            }
            for (let pos2 of this._last_neighbors(pos0[0], pos0[1])) {
                if (legal_pos(pos2)) {
                    last_place_arr.push(pos2);
                }
            }
        }

        this.generate_buffer.splice(0);
    }

    _next_neighbors(row, col){
        switch(layout_number){
            case 1:
                return [[row + 1, col], [row + 1, col + 1], [row + 1, col - 1]];
            case 2:
                if(col%2==0){
                    return [[row + 1, col], [row + 1, col + 1], [row + 1, col - 1]];
                }else{
                    return [[row - 1, col], [row - 1, col - 1], [row - 1, col + 1]];
                }
            case 3:
                if(col>=row-1&&col+row<cols-2){
                    if(row===2&&col===2){
                        return [[row-1, col], [row, col+1]];
                    }
                    return [[row, col+1]];
                }else if(col>row+1){
                    return [[row+1, col]];
                }else if(col+row>cols){
                    if(row===rows-3&&col===cols-3){
                        return [[row+1, col], [row, col-1]];
                    }
                    return [[row, col-1]];
                }else{
                    return [[row-1, col]];
                }
            case 4:
                if(col>=row&&col+row<cols-1){
                    return [[row-1, col],[row-1, col-1],[row-1, col+1]];
                }else if(col>row){
                    return [[row, col+1],[row-1, col+1],[row+1, col+1]];
                }else if(col+row>cols-1){
                    return [[row+1, col],[row+1, col+1],[row+1, col-1]];
                }else{
                    return [[row, col-1],[row+1, col-1],[row-1, col-1]];
                }
            case 5:
                // const output=[];
                // for(let i=0;i<5;i++){
                //     output.push([row+Math.floor(Math.random()*3-1), col+Math.floor(Math.random()*3-1)]);
                // }
                // return output;
            default:
                return [[row + 1, col], [row + 1, col + 1], [row + 1, col - 1]];
        }
    }

    _last_neighbors(row, col){
        switch(layout_number){
            case 1:
                return [[row - 1, col], [row - 1, col - 1], [row - 1, col + 1]];
            case 2:
                if(col%2==1){
                    return [[row + 1, col], [row + 1, col + 1], [row + 1, col - 1]];
                }else{
                    return [[row - 1, col], [row - 1, col - 1], [row - 1, col + 1]];
                }
            case 3:
                if(col>=row&&col+row<cols-1){
                    if(row===2&&col===2){
                        return [[row+1, col], [row, col-1]];
                    }
                    return [[row, col-1]];
                }else if(col>row){
                    if(row===2&&col===cols-3){
                        return [[row, col-1], [row-1, col]];
                    }
                    return [[row-1, col]];
                }else if(col+row>cols-1){
                    return [[row, col+1]];
                }else{
                    if(row===rows-3&&col===2){
                        return [[row, col+1], [row+1, col]];
                    }
                    return [[row+1, col]];
                }
            case 4:
                if(Math.abs(col-6)+Math.abs(row-6)===1){
                    return [];
                }
                if(col===row){
                    if(row<=6){
                        return [[row+1, col+1]];
                    }else{
                        return [[row-1, col-1]];
                    }
                }else if(col+row==cols-1){
                    if(row<=6){
                        return [[row+1, col-1]];
                    }else{
                        return [[row-1, col+1]];
                    }
                }
                if(col>=row&&col+row<cols-1){
                    return [[row+1, col],[row+1, col-1],[row+1, col+1]];
                }else if(col>row){
                    return [[row, col-1],[row-1, col-1],[row+1, col-1]];
                }else if(col+row>cols-1){
                    return [[row-1, col],[row-1, col+1],[row-1, col-1]];
                }else{
                    return [[row, col+1],[row+1, col+1],[row-1, col+1]];
                }
            case 5:
                // const output=[];
                // for(let i=0;i<2;i++){
                //     output.push([row+Math.floor(Math.random()*3-1), col+Math.floor(Math.random()*3-1)]);
                // }
                // return output;
            default:
                return [[row - 1, col], [row - 1, col - 1], [row - 1, col + 1]];
        }
    }

    has_generator(row, col) {
        return legal_pos([row, col]) && !(this._last_places[row][col].length > 0);
    }

    generate(row, col) {
        if(board_contents[row][col]!==0){
            return undefined; //fail to generate
        }
        let cata = NaN;
        if (this.generate_buffer.length > 0) {
            cata = this.generate_buffer.shift();
        } else {
            let current_cata = random_cata();
            while (Math.random() > 1 / generator_corr_length) {
                this.generate_buffer.push(current_cata);
            }
            cata = current_cata;
        }
        console.assert(isFinite(cata));
        let source_pos=this.next_place(row, col)[0];
        if(source_pos===undefined){
            return new Thing(cata, row, col, row - 1, col);
        }else{
            source_pos=[2*row-source_pos[0], 2*col-source_pos[1]];
            return new Thing(cata, row, col, source_pos[0], source_pos[1]);
        }
        
    }

    last_place(row, col) {
        return this._last_places[row][col];
    }

    next_place(row, col) {
        return this._next_places[row][col];
    }

    last_filled_place(row, col){
        for (const pos of this._last_places[row][col]) {
            if (board_things[pos[0]][pos[1]] !== undefined) {
                return pos;
            }
        }
        return undefined;
    }

    next_vacant_place(row, col){
        for (const pos of this._next_places[row][col]) {
            if (board_contents[pos[0]][pos[1]] === 0) {
                return pos;
            }
        }
        return undefined;
    }
}


// special effects
class SETriangle{
    constructor(left, top){
        this.ele=document.createElement('div');
        this.ele.classList.add('SE_triangle');
        ele_board_container.append(this.ele);

        this.angle=Math.random()*360;
        this.transparency=1.0;
        this.left=left;
        this.top=top;
        this.vx=Math.random()*3;
        this.vy=Math.random()*3+1;
        
        this.callback(this);
    }

    callback(self){
        self.ele.style.setProperty('--transparency', self.transparency);
        self.ele.style.setProperty('--angle', self.angle+'deg');
        self.ele.style.left=self.left+'px';
        self.ele.style.top=self.top+'px';
        self.angle+=Math.random()*60;
        self.transparency-=0.02;
        self.left+=self.vx;
        self.top+=self.vy;
        self.vy+=movement_acc*cellWidth;
        if(self.transparency>0){
            setTimeout(()=>{self.callback(self)}, 10);
        }else{
            self.remove();
        }
    }
    
    remove(){
        this.ele.remove();
    }
}

class SEMovingArrow{
    constructor(left, top, direction){
        this.left=left
        this.top=top
        this.vx=10*Math.cos(direction/180*Math.PI);
        this.vy=10*Math.sin(direction/180*Math.PI);
        this.angle=direction;
        this.transparency=1.0

        this.ele=document.createElement('div');
        this.ele.classList.add('SE_MovingArrow');
        ele_board_container.append(this.ele);
        this.callback(this);
    }

    callback(self){
        self.ele.style.setProperty('--transparency', self.transparency);
        self.ele.style.setProperty('--angle', self.angle+'deg');
        self.ele.style.left=self.left+'px';
        self.ele.style.top=self.top+'px';
        self.transparency-=0.005;
        self.left+=self.vx;
        self.top+=self.vy;
        if(self.transparency>0){
            setTimeout(()=>{self.callback(self)}, 10);
        }else{
            self.remove();
        }
    }
    
    remove(){
        this.ele.remove();
    }
}

function run_special_effect_horizontal(row, col) {
    new SEMovingArrow((col+0.6)*cellWidth, row*cellWidth, 0);
    new SEMovingArrow((col-0.6)*cellWidth, row*cellWidth, 180);
}

function run_special_effect_vertical(row, col) {
    new SEMovingArrow(col*cellWidth, (row+0.6)*cellWidth, 90);
    new SEMovingArrow(col*cellWidth, (row-0.6)*cellWidth, 270);
}

function run_special_effect_bingo(row, col) {
    for(let i=0;i<5;i++){
        new SETriangle(col*cellWidth, row*cellWidth);
    }
}


// task system, manage all the tasks
class TaskSystem{
    constructor(){
        this.cataCollect=new Object();
        this.seCollect=new Object();
        this.stepConsumed=0;
        this.tasks=[];
        this.combo=0;
        this.score=0;
        this._reset();
    }

    _reset(){
        for(const clr of [-1,1,2,3,4,5]){
            this.cataCollect[clr]=0;
        }
        this.seCollect['H']=0;
        this.seCollect['V']=0;
        this.seCollect['C']=0;
        this.stepConsumed=0;
        this.combo=0;
        this.score=0;
        for(const taskObj of this.tasks){
            taskObj.ele.remove();
            taskObj.ending_ele.remove();
        }
        this.tasks.splice(0);
        this.tasks.push(new TaskObj('step', NaN, false));
        if(Math.random()<0.5){
            this.tasks.push(new TaskObj('cata100', random_cata(), false));
        }else{
            let cata1=random_cata();
            let cata2;
            while(1){
                cata2=random_cata();
                if(cata2!==cata1){
                    break;
                }
            }
            this.tasks.push(new TaskObj('cata50', cata1, false));
            this.tasks.push(new TaskObj('cata50', cata2, false));
        }
        this.tasks.push(new TaskObj('cata200', random_cata(), true));
        this.tasks.push(new TaskObj('se', Math.floor(Math.random()*4), true));
        this.tasks.push(new TaskObj('score', NaN, true));
    }

    _refresh(){
        for(const taskObj of this.tasks){
            taskObj.refresh(this);
        }
        // perfect
        let accomplished=true;
        for(let i=1;i<this.tasks.length;i++){
            if(!this.tasks[i].accomplished()){
                accomplished=false;
                break;
            }
        }
        if(accomplished){
            callbacks_flowing_vanish.push(()=>{
                tasksystem._addRecord(true, 3);
                this._set_ending_stars(3, true);                        
                task_end(true);
            });
            return;
        }
        // ok
        accomplished=true;
        for(let i=1;i<this.tasks.length-3;i++){
            if(!this.tasks[i].accomplished()){
                accomplished=false;
                break;
            }
        }
        // fail or not
        if(this.tasks[0].accomplished()){
            let optionalAccomplishedCount=0;
            for(let i=this.tasks.length-3;i<this.tasks.length;i++){
                if(this.tasks[i].accomplished()){
                    optionalAccomplishedCount++;
                }
            }
            callbacks_flowing_vanish.push(()=>{
                tasksystem._addRecord(accomplished, optionalAccomplishedCount);
                this._set_ending_stars(optionalAccomplishedCount, accomplished);
                task_end(accomplished);
            })
            return;
        }
    }

    force_end(){
        let accomplished=true;
        for(let i=1;i<this.tasks.length-3;i++){
            if(!this.tasks[i].accomplished()){
                accomplished=false;
                break;
            }
        }
        {
            let optionalAccomplishedCount=0;
            for(let i=this.tasks.length-3;i<this.tasks.length;i++){
                if(this.tasks[i].accomplished()){
                    optionalAccomplishedCount++;
                }
            }
            tasksystem._addRecord(accomplished, optionalAccomplishedCount);
            this._set_ending_stars(optionalAccomplishedCount, accomplished);
            task_end(accomplished);
        }
    }

    _addRecord(accomplished, optionalAccomplishedCount){
        // to be modified
        const obj={
            'cataCollect':this.cataCollect,
            'stepConsumed':this.stepConsumed,
            'seCollect':this.seCollect,
            'score':this.score,
            'accomplished':accomplished,
            'optionalAccomplishedCount':optionalAccomplishedCount,
            'layoutType':layout_number,
            'corrLength':generator_corr_length, 
            'fruitCataNumber':thing_cata_enabled.length
        }
        gamestats.addRecord(obj);
        // console.log('call add record', JSON.stringify(obj));
    }

    addCounter(cata, se_H, se_v){
        this.cataCollect[cata]++;
        this.combo++;
        this.score+=Math.min(50*Math.ceil(this.combo/3), 300);
        if(se_H){
            this.seCollect['H']++;
            this.score+=150;
        }
        if(se_v){
            this.seCollect['V']++;
            this.score+=150;
        }
        if(se_H&&se_v){
            this.seCollect['C']++;
            this.score+=50;
        }
        this._refresh();
    }

    addStep(){
        this.stepConsumed++;
        this.combo=0;
        this._refresh();
    }

    _set_ending_stars(count, winning){
        if(!winning){count=0;}
        switch(count){
            case 3:
                ele_ending_stars.classList.remove('phase1');
                ele_ending_stars.classList.remove('phase2');
                ele_ending_stars.classList.add('phase3');
                ele_ending_caption.innerText='Perfect!';
                break;
            case 2:
                ele_ending_stars.classList.remove('phase1');
                ele_ending_stars.classList.add('phase2');
                ele_ending_stars.classList.remove('phase3');
                ele_ending_caption.innerText='Well Done!';
                break;
            case 1:
                ele_ending_stars.classList.add('phase1');
                ele_ending_stars.classList.remove('phase2');
                ele_ending_stars.classList.remove('phase3');
                ele_ending_caption.innerText='Good!';
                break;
            default:
                ele_ending_stars.classList.remove('phase1');
                ele_ending_stars.classList.remove('phase2');
                ele_ending_stars.classList.remove('phase3');
                ele_ending_caption.innerText='A Narrow Victory!';
                break;
        }
        if(!winning){ele_ending_caption.innerText='Good Luck Next Time!'}
        return;                        
    }

}

// a single task with its elements
class TaskObj{
    constructor(taskType, taskVal, optionalFlag){
        // task panel elements
        this.ele=document.createElement('div');
        this.ele.classList.add('task_container');
        ele_task_panel_container.append(this.ele);

        this.ele_flag=document.createElement('div');
        if(optionalFlag){
            this.ele_flag.classList.add('task_star');
        }else{
            this.ele_flag.classList.add('task_tick');
        }
        
        this.ele.append(this.ele_flag);

        this.ele_icon=document.createElement('div');
        this.ele_icon.classList.add('task_icon');
        this.ele.append(this.ele_icon);

        this.ele_text=document.createElement('div');
        this.ele_text.classList.add('task_text');
        this.ele.append(this.ele_text);

        this.ele_current=document.createElement('span');
        this.ele_current.innerHTML='00';
        this.ele_text.append(this.ele_current);

        this.ele_slash=document.createElement('span');
        this.ele_slash.innerHTML='/';
        this.ele_text.append(this.ele_slash);

        this.ele_required=document.createElement('span');
        this.ele_required.innerHTML='00';
        this.ele_text.append(this.ele_required);

        // ending panel elements
        this.ending_ele=document.createElement('div');
        this.ending_ele.classList.add('task_container');
        this.ending_ele.classList.add('ending_element');
        ele_ending_tasks.append(this.ending_ele);

        this.ending_ele_flag=document.createElement('div');
        this.ending_ele_flag.classList.add('ending_icon');
        if(optionalFlag){
            this.ending_ele_flag.classList.add('task_star');
        }else{
            this.ending_ele_flag.classList.add('task_tick');
        }
        
        this.ending_ele.append(this.ending_ele_flag);

        this.ending_ele_icon=document.createElement('div');
        this.ending_ele_icon.classList.add('task_icon');
        this.ending_ele_icon.classList.add('ending_icon');
        this.ending_ele.append(this.ending_ele_icon);

        this.ending_ele_text=document.createElement('div');
        this.ending_ele_text.classList.add('task_text');
        this.ending_ele.append(this.ending_ele_text);

        this.ending_ele_current=document.createElement('span');
        this.ending_ele_current.innerHTML='00';
        this.ending_ele_text.append(this.ending_ele_current);

        this.ending_ele_slash=document.createElement('span');
        this.ending_ele_slash.innerHTML='/';
        this.ending_ele_text.append(this.ending_ele_slash);

        this.ending_ele_required=document.createElement('span');
        this.ending_ele_required.innerHTML='00';
        this.ending_ele_text.append(this.ending_ele_required);


        this.current_count=0;
        this.required_count=0;
        this.taskType=taskType;

        this.color0=[220, 30, 30];
        this.color1=[255, 201, 30];
        this.color2=[30, 220, 30];

        if(!optionalFlag){
            switch(taskType){
                case 'step':
                    this.acquire_count=()=>{this.current_count=tasksystem.stepConsumed};
                    _step_overflow=false;
                    this.required_count=+total_steps;
                    this.ele_icon.innerText=obtain_clock_emoji(); 
                    this.ending_ele_icon.innerText=obtain_clock_emoji();
                    this.ele_flag.classList.add('task_step');
                    this.ending_ele_flag.classList.add('task_step');
                    [this.color0, this.color2]=[this.color2, this.color0];
                    break;
                case 'cata50':
                    this.cata=taskVal;
                    console.assert(this.cata!==undefined);
                    this.acquire_count=()=>{this.current_count=tasksystem.cataCollect[this.cata]};
                    this.required_count=50;
                    this.ele_icon.classList.add(`cata${this.cata}`);
                    this.ending_ele_icon.classList.add(`cata${this.cata}`);
                    break;
                case 'cata100':
                    this.cata=taskVal;
                    console.assert(this.cata!==undefined);
                    this.acquire_count=()=>{this.current_count=tasksystem.cataCollect[this.cata]};
                    this.required_count=100;
                    this.ele_icon.classList.add(`cata${this.cata}`);
                    this.ending_ele_icon.classList.add(`cata${this.cata}`);
                    break;
                default: 
                    throw new Error('unknown task type');
            }
        }else{
            switch(taskType){
                case 'cata200':
                    this.cata=taskVal;
                    console.assert(this.cata!==undefined);
                    this.acquire_count=()=>{this.current_count=tasksystem.cataCollect[this.cata]};
                    this.required_count=320;
                    this.ele_icon.classList.add(`cata${this.cata}`);
                    this.ending_ele_icon.classList.add(`cata${this.cata}`);
                    break;
                case 'se':
                    if(taskVal===0){
                        this.acquire_count=()=>{this.current_count=tasksystem.seCollect['H']};
                        this.required_count=10;
                        this.ele_icon.classList.add(`SE_horizontal`);
                        this.ending_ele_icon.classList.add(`SE_horizontal`);
                    }else if(taskVal===1){
                        this.acquire_count=()=>{this.current_count=tasksystem.seCollect['V']};
                        this.required_count=10;
                        this.ele_icon.classList.add(`SE_vertical`);
                        this.ending_ele_icon.classList.add(`SE_vertical`);
                    }else if(taskVal===2){
                        this.acquire_count=()=>{this.current_count=tasksystem.seCollect['C']};
                        this.required_count=5;
                        this.ele_icon.classList.add(`SE_horizontal`);
                        this.ele_icon.classList.add(`SE_vertical`);
                        this.ending_ele_icon.classList.add(`SE_horizontal`);
                        this.ending_ele_icon.classList.add(`SE_vertical`);
                    }else{
                        this.acquire_count=()=>{this.current_count=tasksystem.cataCollect[-1]};
                        this.required_count=2;
                        this.ele_icon.classList.add(`cata-1`);
                        this.ending_ele_icon.classList.add(`cata-1`);
                    }
                    
                    break;
                case 'score':
                    this.acquire_count=()=>{this.current_count=tasksystem.score};
                    this.required_count=500000;
                    this.ele_icon.innerText='💯'; 
                    this.ending_ele_icon.innerText='💯';
                    this.ele_text.style.fontSize='calc(var(--task-system-size)*0.4)';
                    break;
                default: 
                    throw new Error('unknown task type');
            }
        }
        if(taskType!=='step'){
            this.required_count=Math.max(Math.round(this.required_count*difficulty_coeff), 1);
        }
        this._refresh();
    }

    accomplished(){
        this.acquire_count();
        if(this.taskType==='step'){
            if(this.current_count>=this.required_count){
                _step_overflow=true;
            }
        }
        return this.current_count>=this.required_count;
    }

    refresh(){
        this.acquire_count();
        this._refresh();
    }

    _refresh(){
        this.ele_current.innerHTML=this.current_count;
        this.ele_required.innerHTML=this.required_count;
        this.ending_ele_current.innerHTML=this.current_count;
        this.ending_ele_required.innerHTML=this.required_count;
        let beta=this.current_count/this.required_count;
        let color=[];
        if(beta>=1){
            color=this.color2;
            this.ele_flag.classList.add('done');
            this.ending_ele_flag.classList.add('done');
        }else{
            for(let i=0;i<3;i++){
                color.push(this.color0[i]*(1-beta)+this.color1[i]*beta)
            }
            this.ele_flag.classList.remove('done');
            this.ending_ele_flag.classList.remove('done');
        }
        this.ele_current.style.color=`rgb(${color[0]},${color[1]},${color[2]})`;
        {
            const color0=this.color0;
            const color1=this.color1;
            const color2=this.color2;
            if(this.taskType==='step'){
                if(beta<1){
                    this.ending_ele_current.style.color=`rgb(${color0[0]},${color0[1]},${color0[2]})`;
                }else if(Math.abs(beta-1)<=1e-7){
                    this.ending_ele_current.style.color=`rgb(${color1[0]},${color1[1]},${color1[2]})`;
                    this.ending_ele_flag.classList.remove('done');
                }else{
                    this.ending_ele_current.style.color=`rgb(${color2[0]},${color2[1]},${color2[2]})`;
                }
            }else{
                if(beta>=1){
                    this.ending_ele_current.style.color=`rgb(${color2[0]},${color2[1]},${color2[2]})`;
                }else{
                    this.ending_ele_current.style.color=`rgb(${color0[0]},${color0[1]},${color0[2]})`;
                }
            }
        }
        return;
    }
}


// storage and restoring of gaming data, to be modified
class GamingStats{
    constructor(){
        this.records=[];
        if(local_storage_enabled){
            const old_records=JSON.parse(localStorage.getItem('gameRecords'));
            if(old_records===undefined||old_records===null){
                localStorage.setItem('gameRecords', '[]');
            }
            try{
                for(const rec of old_records){
                    this.records.push(rec);
                }
            }catch{
                localStorage.setItem('gameRecords', '[]');
            };
        }
        
    }

    addRecord(obj){
        this.showRecord(obj);
        this.records.push(obj);
        if(local_storage_enabled){
            localStorage.setItem('gameRecords', JSON.stringify(this.records));
        }
    }

    showRecord(obj){
        
        // {
        //     'cataCollect':this.cataCollect,
        //     'stepConsumed':this.stepConsumed,
        //     'seCollect':this.seCollect,
        //     'score':this.score,
        //     'accomplished':accomplished,
        //     'optionalAccomplishedCount':optionalAccomplishedCount
        // }
    }

    refreshStats(){

    }
};

const connections = new Connections();
const tasksystem = new TaskSystem();
const gamestats=new GamingStats();

function game_ready(){
    if(gameOn===1){tasksystem.force_end();}
    gameOn=0;
    for(const slider of sliders){slider.enable();}
    for(const ele of [ele_mask, ele_setting_page]){
        ele.classList.remove('hidden');
    }
    ele_ending_page.classList.add('hidden');
    ele_start_game_button.classList.remove('disabled');
    ele_settings_button.classList.add('disabled');
    flowing=0;
}

// called when game starts
function game_start(){
    gameOn=1;
    for(const slider of sliders){slider.disable();}
    for(const ele of [ele_mask, ele_setting_page, ele_ending_page]){
        ele.classList.add('hidden');
    }
    ele_start_game_button.classList.add('disabled');
    ele_settings_button.classList.add('disabled');
    board_reset();
    connections.init();
    tasksystem._reset();
    
    // begin to fill the board, trigger off the process
    setTimeout(() => {
        for (const pos of all_places()) {
            const [row, col] = pos;
            if (connections.has_generator(row, col)) {
                connections.generate(row, col);
            }
        }
    }, 100);
}

// called when a task ends
function task_end(accomplish){
    if(gameOn!==1){return;}
    gameOn=2;
    for(const ele of [ele_mask, ele_ending_page]){
        ele.classList.remove('hidden');
    }
    ele_setting_page.classList.add('hidden');
    ele_start_game_button.classList.add('disabled');
    ele_settings_button.classList.remove('disabled');
    // if(accomplish){
    //     console.log('task end accomplished')
    // }else{
    //     console.log('task end failed')
    // }
}

// check the board, then perform the bingo as soon as possible
function check_board_bingo(row, col) {
    const to_be_vanished = [];
    const [row0, col0] = [row, col]
    // horizontal
    function _get_special_coord(coords) {
        for (const coord of coords) {
            if (row0 === coord[0] && col0 === coord[1]) {
                return coord.concat();
            }
        }
        for (const coord of coords) {
            if (Math.abs(row0 - coord[0]) + Math.abs(col0 - coord[1]) === 1) {
                return coord.concat();
            }
        }
        return coords[0];
    }
    for (let _row = 0; _row < rows; _row++) {
        let prevKind = 0;
        const coords = [];
        for (let _col = 0; _col < cols; _col++) {
            if (board_things[_row][_col] !== undefined && board_things[_row][_col].cata === prevKind) {
                coords.push([_row, _col]);
            } else {
                if (coords.length >= 3) {
                    to_be_vanished.push({
                        coords: coords.concat(),
                        cata: prevKind,
                        direction: 'horizontal',
                        special_coord: _get_special_coord(coords)
                    });
                }
                coords.splice(0);
                if (!(board_things[_row][_col] === undefined)) {
                    prevKind = board_things[_row][_col].cata;
                    coords.push([_row, _col]);
                }

            }
        }
        if (coords.length >= 3) {
            to_be_vanished.push({
                coords: coords.concat(),
                cata: prevKind,
                direction: 'horizontal',
                special_coord: _get_special_coord(coords)
            });
        }
    }

    // vertical
    function _add_vertical_record(coords, prevKind) {
        for (let record of to_be_vanished) {
            if (record.direction === 'vertical') { break; }
            if (record.cata !== prevKind) { continue; }
            for (const coord of coords) {
                for (const coords2 of record.coords) {
                    // if a vertical and a horizontal intersects,,
                    if (coord[0] === coords2[0] && coord[1] === coords2[1]) {
                        // change the record into cross type
                        if(record.coords.length>=5||coords.length>=5){
                            record.direction='cross5' // 5-in-a-line cross type
                        }else{
                            record.direction = 'cross';
                        }
                        // push the vertical record into horizontal ones
                        for (const coord3 of coords) {
                            if (!(coord[0] === coord3[0] && coord[1] === coord3[1])) {
                                record.coords.push(coord3);
                            }
                        }
                        record.special_coord = coord.concat();
                        return;
                    }
                }
            }
        }
        // none of horizontal records intersects with the vertical record
        to_be_vanished.push({
            coords: coords.concat(),
            cata: prevKind,
            direction: 'vertical',
            special_coord: _get_special_coord(coords)
        })
    }

    for (let _col = 0; _col < cols; _col++) {
        let prevKind = 0;
        const coords = [];
        for (let _row = 0; _row < rows; _row++) {
            if (board_things[_row][_col] !== undefined && board_things[_row][_col].cata === prevKind) {
                coords.push([_row, _col]);
            } else {
                if (coords.length >= 3) {
                    _add_vertical_record(coords, prevKind);
                }
                coords.splice(0);
                if (!(board_things[_row][_col] === undefined)) {
                    prevKind = board_things[_row][_col].cata;
                    coords.push([_row, _col]);
                }
            }
        }
        if (coords.length >= 3) {
            _add_vertical_record(coords, prevKind);
        }
    }

    // vanish
    if (to_be_vanished.length === 0) {
        return false;
    }

    for (const record of to_be_vanished) {
        console.assert(record.cata !== 0);
        if (record.direction === 'cross') {
            for (const coord of record.coords.sort((a1, b1) => (100 * (a1[0] - b1[0]) + (a1[1] - b1[1])))) {
                const thing = acquire_thing(coord[0], coord[1]);
                if (thing === undefined) {
                    continue;
                }
                if (!(coord[0] === record.special_coord[0] && coord[1] === record.special_coord[1]))
                    thing.callback_bingo();
                else {
                    thing.callback_SE_release();
                    thing.setSEHorizontal();
                    thing.setSEVertical();
                }
            }
        } else if (record.direction === 'cross5') {
            for (const coord of record.coords.sort((a1, b1) => (100 * (a1[0] - b1[0]) + (a1[1] - b1[1])))) {
                const thing = acquire_thing(coord[0], coord[1]);
                if (thing === undefined) {
                    continue;
                }
                if (!(coord[0] === record.special_coord[0] && coord[1] === record.special_coord[1]))
                    thing.callback_bingo();
                else {
                    thing.callback_SE_release();
                    thing.reset_cata(-1);
                }
            }
        } else if (record.coords.length >= 5) {
            for (const coord of record.coords) {
                const thing = acquire_thing(coord[0], coord[1]);
                if (thing === undefined) {
                    continue;
                }
                if (!(coord[0] === record.special_coord[0] && coord[1] === record.special_coord[1]))
                    thing.callback_bingo();
                else {
                    thing.callback_SE_release();
                    thing.reset_cata(-1);
                }
            }
        } else if (record.coords.length >= 4) {
            for (const coord of record.coords) {
                const thing = acquire_thing(coord[0], coord[1]);
                if (thing === undefined) {
                    continue;
                }
                if (!(coord[0] === record.special_coord[0] && coord[1] === record.special_coord[1]))
                    thing.callback_bingo();
                else {
                    thing.callback_SE_release();
                    if (record.direction === 'horizontal') {
                        thing.setSEVertical();
                    } else {
                        thing.setSEHorizontal();
                    }
                }

            }

        } else {
            for (const coord of record.coords) {
                const thing = acquire_thing(coord[0], coord[1]);
                if (thing === undefined) {
                    continue;
                }
                thing.callback_bingo();
            }
        }
    }
    return true;
}

// check the board, to see if there is any bingo possible, but do not perform the bingo
function check_board_without_bingo_any() {
    // horizontal
    for (let _row = 0; _row < rows; _row++) {
        let prevKind = 0;
        const coords = [];
        for (let _col = 0; _col < cols; _col++) {
            if (board_things[_row][_col] !== undefined && board_things[_row][_col].cata === prevKind) {
                coords.push([_row, _col]);
            } else {
                if (coords.length >= 3) {
                    return true;
                }
                coords.splice(0);
                if (!(board_things[_row][_col] === undefined)) {
                    prevKind = board_things[_row][_col].cata;
                    coords.push([_row, _col]);
                }

            }
        }
        if (coords.length >= 3) {
            return true;
        }
    }
    // vertical
    for (let _col = 0; _col < cols; _col++) {
        let prevKind = 0;
        const coords = [];
        for (let _row = 0; _row < rows; _row++) {
            if (board_things[_row][_col] !== undefined && board_things[_row][_col].cata === prevKind) {
                coords.push([_row, _col]);
            } else {
                if (coords.length >= 3) {
                    return true;
                }
                coords.splice(0);
                if (!(board_things[_row][_col] === undefined)) {
                    prevKind = board_things[_row][_col].cata;
                    coords.push([_row, _col]);
                }
            }
        }
        if (coords.length >= 3) {
            return true;
        }
    }
    return false;
}

// check the board, to see if there is any swap possible
function check_board_swappable(){
    // to be modified
    return true;
}

// base class for thing, including movements and html elements. 
class Thing {
    constructor(cata, row, col, initrow, initcol) {
        this.cata = +cata;
        this.row = row;
        this.col = col;
        this.SE_horizontal = false;
        this.SE_vertical = false;
        console.assert(board_contents[this.row][this.col] === 0);

        // create elements
        this.ele = document.createElement('div');
        this.ele.classList.add('board_thing');
        this.ele.classList.add(`cata${this.cata}`);
        ele_board_container.append(this.ele);
        const self = this;
        this.ele.addEventListener('mousedown', () => { self._callback_mousedown() })
        this.ele.addEventListener('mouseup', () => { self._callback_mouseup() })
        this.bind_touch_move_direction(this.ele, (direction)=>self._callback_touchmove(direction));

        // init movements
        this.movements = [];
        this.velocity = movement_v0;
        if (!(initrow === row && initcol === col)) {
            this.calculate_movements(initrow, initcol, row, col);
        } else {
            board_things[this.row][this.col] = this;
        }
        board_contents[this.row][this.col] = this.cata;
        this.callback_move(this);
    }

    reset_cata(new_cata) {
        this.ele.classList.remove(`cata${this.cata}`);
        this.cata = +new_cata;
        this.ele.classList.add(`cata${this.cata}`);
    }

    _leave() {
        board_contents[this.row][this.col] = 0;
        board_things[this.row][this.col] = undefined;
        if (connections !== undefined) {
            if (connections.has_generator(this.row, this.col)) {
                connections.generate(this.row, this.col);
                return;
            }
            {
                const pos=connections.last_filled_place(this.row, this.col);
                if (pos!==undefined && board_things[pos[0]][pos[1]] !== undefined) {
                    board_things[pos[0]][pos[1]].goto(this.row, this.col);
                    return;
                }
            }
        }
    }

    goto(newrow, newcol) {
        if (board_contents[newrow][newcol] !== 0) {
            throw new Error("Try to move to an occupied cell");
        }
        this.calculate_movements(this.row, this.col, newrow, newcol);
        this._leave();
        this.row = newrow;
        this.col = newcol;
        board_contents[this.row][this.col] = this.cata;
        this.callback_move(this);
    }

    calculate_movements(fromrow, fromcol, torow, tocol) {
        let direction = [torow - fromrow, tocol - fromcol];
        let distance = Math.sqrt(direction[0] ** 2 + direction[1] ** 2);
        direction[0] /= distance; direction[1] /= distance;
        let x = 0;
        while (x < distance) {
            this.movements.push([fromrow + direction[0] * x, fromcol + direction[1] * x])
            this.velocity += movement_acc;
            x += this.velocity;
        }
    }

    callback_move(self, callback = (b) => { }) {
        flowing++;
        _last_check_flowing=true;
        if (this.ele === undefined) {
             flowing--;
             return; 
        }
        if(gameOn===0){
            flowing--;
            // force removal
            this.ele.remove();
            board_contents[this.row][this.col]=0;
            if(board_things[this.row][this.col]===this){
                board_things[this.row][this.col]=undefined;
            }
            return;
        }
        if (self.movements.length === 0) {
            self._callback_arrival(self, callback);
            return;
        } else {
            setTimeout(() => { flowing--;self.callback_move(self, callback) }, 10);
        }
        let [row, col] = self.movements.shift();
        let left = Math.round(col * cellWidth) + 'px';
        let top = Math.round(row * cellWidth) + 'px';
        self.ele.style.left = left;
        self.ele.style.top = top;
        return;
    }

    _callback_arrival(self, callback = (b) => { }) {
        flowing--;
        if (this.ele === undefined) { return; }
        this.movements.splice(0);
        this.ele.style.left = Math.round(this.col * cellWidth) + 'px';
        this.ele.style.top = Math.round(this.row * cellWidth) + 'px';

        let next_dest = connections.next_vacant_place(this.row, this.col);
        if (next_dest === undefined) {
            this.velocity = movement_v0;
            if (!(board_things[this.row][this.col] === undefined || board_things[this.row][this.col] === this)) {
                if(board_things[this.row][this.col].ele!==undefined){
                    this.ele.remove();
                    this.ele = undefined;
                    board_contents[this.row][this.col]=board_things[this.row][this.col].cata;
                    // console.log("soft error: placing conflict, case 1");
                    return;
                }
                // console.log("soft error: placing conflict, case 2");
            };
            board_things[this.row][this.col] = this;
            board_contents[this.row][this.col] = this.cata;
            if (callback !== undefined)
                setTimeout(callback(check_board_bingo(this.row, this.col)), 50);
        } else {
            let [row, col] = next_dest;
            this.goto(row, col);
        }
    }

    callback_bingo() {
        if (this.movements.length !== 0) {
            // throw new Error("try to bingo moving things");
            this.movements.splice(0);
        }
        board_things[this.row][this.col] = undefined;
        run_special_effect_bingo(this.row, this.col);
        this.callback_SE_release();
        setTimeout(() => {
            if (this.ele !== undefined) {
                this.ele.remove();
            }
            this.ele = undefined;
            this._leave();
        }, 10);

        return;
    }

    callback_SE_release() {
        if (this.cata === -1) {
            let cata2 = random_cata();
            if(this.target_color!==undefined){
                cata2=this.target_color;
            }
            for (const [row2, col2] of all_places()) {
                const thing = acquire_thing(row2, col2);
                if (thing !== undefined && thing.cata === cata2) {
                    thing.callback_bingo();
                }
            }
        }
        if (tasksystem !== undefined) {
            tasksystem.addCounter(this.cata, this.SE_horizontal, this.SE_vertical);
        }
        if (this.SE_horizontal) {
            run_special_effect_horizontal(this.row, this.col);
            this.SE_horizontal = false;
            this.ele.classList.remove('SE_horizontal');
            for (let col = 0; col < cols; col++) {
                let thing = acquire_thing(this.row, col);
                if (thing !== undefined && thing !== this) {
                    thing.callback_bingo();
                }
            }
        }
        if (this.SE_vertical) {
            run_special_effect_vertical(this.row, this.col);
            this.SE_vertical = false;
            this.ele.classList.remove('SE_vertical');
            for (let row = 0; row < rows; row++) {
                let thing = acquire_thing(row, this.col);
                if (thing !== undefined && thing !== this) {
                    thing.callback_bingo();
                }
            }
        }
    }

    setSEHorizontal() {
        this.SE_horizontal = true;
        this.ele.classList.add('SE_horizontal');
    }

    setSEVertical() {
        this.SE_vertical = true;
        this.ele.classList.add('SE_vertical');
    }

    swap(other) {
        if(_swap_cooling_down>0){/*console.log("swap cooling down")*/;return;}
        if(_step_overflow){/*console.log("step overflow")*/;return;}
        else{_swap_cooling_down=2;}
        const [newrow, newcol] = [other.row, other.col];
        this.calculate_movements(this.row, this.col, newrow, newcol);
        other.calculate_movements(newrow, newcol, this.row, this.col);
        board_contents[this.row][this.col] = other.cata;
        board_things[this.row][this.col] = other;
        board_contents[newrow][newcol] = this.cata;
        board_things[newrow][newcol] = this;
        other.row = this.row;
        other.col = this.col;
        this.row = newrow;
        this.col = newcol;
        const self = this;

        let callback1 = () => { };
        let callback2 = () => { };
        if (self.cata === -1) {
            if (other.cata === -1) {
                callback1 = () => {
                    other.callback_bingo();
                    self.callback_bingo();
                    for (const [row2, col2] of all_places()) {
                        const thing = acquire_thing(row2, col2);
                        if (thing !== undefined) {
                            thing.callback_bingo();
                        }
                    }
                }
                
            } else {
                const cata2 = other.cata;
                callback2 = () => {
                    for (const [row2, col2] of all_places()) {
                        const thing = acquire_thing(row2, col2);
                        if (thing !== undefined && thing.cata === cata2) {
                            if (other.SE_horizontal && other.SE_vertical) {
                                thing.setSEHorizontal();
                                thing.setSEVertical();
                            } else if (other.SE_horizontal || other.SE_vertical) {
                                if (Math.random() < 0.5) {
                                    thing.setSEHorizontal();
                                } else {
                                    thing.setSEVertical();
                                }
                            }
                        }
                    }
                    self.target_color=cata2;
                    self.callback_bingo();
                }
                
            }

        } else if (other.cata === -1) {
            const cata2 = self.cata;
            callback1 = () => {
                for (const [row2, col2] of all_places()) {
                    const thing = acquire_thing(row2, col2);
                    if (thing !== undefined && thing.cata === cata2) {
                        if (self.SE_horizontal && self.SE_vertical) {
                            thing.setSEHorizontal();
                            thing.setSEVertical();
                        } else if (self.SE_horizontal || self.SE_vertical) {
                            if (Math.random() < 0.5) {
                                thing.setSEHorizontal();
                            } else {
                                thing.setSEVertical();
                            }
                        }
                    }
                }
                other.target_color=cata2;
                other.callback_bingo();
            }
            
        } else if ((self.SE_horizontal || self.SE_vertical) && (other.SE_horizontal || other.SE_vertical)) {
            callback1 = () => {
                self.callback_bingo();
            }
            callback2 = () => {
                other.callback_bingo();
            }
        }

        this.callback_move(this, callback1);
        other.callback_move(other, callback2);

        setTimeout(() => {
            if (_last_check_flowing) {
                // console.log("still flowing");
                if (tasksystem !== undefined) {
                    tasksystem.addStep();
                }
                _swap_cooling_down=0;
                return;
            }
            _swap_cooling_down=2;
            // console.log('inactive flowing');
            const [newrow, newcol] = [other.row, other.col];
            self.calculate_movements(self.row, self.col, newrow, newcol);
            other.calculate_movements(newrow, newcol, self.row, self.col);
            board_contents[self.row][self.col] = other.cata;
            board_things[self.row][self.col] = other;
            board_contents[newrow][newcol] = self.cata;
            board_things[newrow][newcol] = self;
            other.row = self.row;
            other.col = self.col;
            self.row = newrow;
            self.col = newcol;
            self.callback_move(self, ()=>{_swap_cooling_down--;});
            other.callback_move(other, ()=>{_swap_cooling_down--;});
        }, swap_time_estimate + 100);
        // console.log('t', swap_time_estimate + 100);
    }

    _callback_mousedown() {
        dragStart.row = this.row;
        dragStart.col = this.col;
        // console.log(`mouse down on (${this.row},${this.col})`);
    }

    _callback_mouseup() {
        // console.log(`mouse up on (${this.row},${this.col})`);
        const [r, c] = [this.row, this.col];
        const [r0, c0] = [dragStart.row, dragStart.col];
        dragStart.row = NaN;
        dragStart.col = NaN;
        // console.log(r0, c0, r, c);
        if (!legal_pos([r0, c0])) { return; }
        if (!legal_pos([r, c])) { return; }
        if (flowing>0) { return; }
        if(gameOn!==1){return;}
        if (Math.abs(r - r0) + Math.abs(c - c0) === 1) {
            const thing = board_things[r0][c0];
            const thing2 = board_things[r][c];
            // console.log(thing, thing2);
            if (thing !== undefined && thing2 !== undefined) {
                thing.swap(thing2);
                // console.log(thing, thing2);
            }
        }
    }

    bind_touch_move_direction(){
        const self=this;
        this.touchStartPos=[NaN, NaN];
        this.ele.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchStartPos=[e.touches[0].clientX, e.touches[0].clientY];
        }, false);

        this.ele.addEventListener('touchend', (e) => {
            e.preventDefault();
            let relPos=[e.changedTouches[0].clientX-this.touchStartPos[0], e.changedTouches[0].clientY-this.touchStartPos[1]];
            let poslength=Math.sqrt(relPos[0]**2+relPos[1]**2);
            self._callback_touchmove([relPos[0]/poslength, relPos[1]/poslength]);
        }, false);

        this.ele.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, false);
    }

    _callback_touchmove(direction){
        if(flowing>0){return;}
        if(gameOn!==1){return;}
        let thing2;
        if(direction[0]>0.9){
            thing2=board_things[this.row][this.col+1];
        }else if(direction[0]<-0.9){
            thing2=board_things[this.row][this.col-1];
        }else if(direction[1]>0.9){
            thing2=board_things[this.row+1][this.col];
        }else if(direction[1]<-0.9){
            thing2=board_things[this.row-1][this.col];
        }
        if(thing2!==undefined){
            this.swap(thing2);
            // console.log(this, thing2);
        }
    }
};

// start_game button
ele_start_game_button.addEventListener('mouseup', game_start);
ele_start_game_button.addEventListener('touchend', game_start);
ele_settings_button.addEventListener('mouseup', game_ready);
ele_settings_button.addEventListener('touchend', game_ready);
ele_restart_button.addEventListener('mouseup', game_ready);
ele_restart_button.addEventListener('touchend', game_ready);
game_ready();

//...
document.addEventListener('contextmenu',(e)=>{e.preventDefault()});
document.addEventListener('keydown', (e)=>{if(e.key.toUpperCase()==='F12'){e.preventDefault()}});

})()