var game = {
  reset: function() {
    this.board = new Array(42).fill(0);
    this.columnHeights = [0,0,0,0,0,0,0];
    this.mode = "PvC";
    this.turn = 1;
    this.moveHistory = [];
    this.ended = false;
    this.waiting = false;
  },
  get toMove(){
    switch (this.mode) {
      case "PvP": return "P";
        break;
      case "CvC": return "C";
        break;
      case "PvC": return game.turn > 0 ? "P" : "C";
        break;
      case "CvP": return game.turn > 0 ? "C" : "P";
    }
  }
}
game.reset();
// var board = new Array(42).fill(0);
// var turn = 1, soloMode = false, gameEnded = false, allowedToMove = true;
// var game.moveHistory = [];
var $undo = $('#undo'),
    $message = $('#message'),
    $progress = $('#progress'),
    $boardCode = $('#board-code');

var $columns = [
  $('#col1'),
  $('#col2'),
  $('#col3'),
  $('#col4'),
  $('#col5'),
  $('#col6'),
  $('#col7')
];

if(window.Worker) {
  var ai = new Worker("ai.js");
} else {
  alert("Sorry, you need a newer browser to use this application.");
}
ai.onmessage = function(e) {
  console.timeEnd("Search time");

  doMove(game.turn, e.data[0]);
  $progress.removeClass('active');

  if(game.mode == "CvC" && !game.ended) {
    requestMove();
  } else {
    game.waiting = false;
  }

};

$('.column').on({
  click: function(){
    if(game.ended || game.waiting) return;

    var move = $(this).attr('id').slice(3) - 1;

    doMove(game.turn, move);

    if(game.mode == "PvP" || game.ended) return;

    requestMove();

  },
});


$undo.click(undo);

$(document).on('click', function(event) { //hide the menu when user clicks outside
  if (!$(event.target).closest('#new').length) {
    $('#game-type-dropdown').removeClass('active');
  }
});
$('#new').click(function(e){//New game!
  $('#game-type-dropdown').toggleClass('active');
  if(e.target.className == "menu-item") {
    game.reset();
    game.mode = e.target.id;
    emptyBoard();
    updateMessage('');
    updateCodeField();

    if(game.mode.indexOf("C") == 0) requestMove();
  }
});

$boardCode.focus(function() {
    var $ths = $(this);
    $ths.select();

    // Work around Chrome's little problem
    $ths.mouseup(function() {
        // Prevent further mouseup intervention
        $ths.unbind("mouseup");
        return false;
    });
});
$('#goto').click(function(){
  try {
    var newG = JSON.parse($boardCode.val());
  } catch(error) {
    alert("Invalid input");
    return;
  }
  game.reset();
  game.board = newG[0];
  game.columnHeights = newG[1];
  game.mode = newG[2];
  game.turn = newG[3];;
  game.moveHistory = newG[4];;

  emptyBoard();
  setupBoard();
})



function emptyBoard() {
  for(var i = 0; i < 7; i++)
    $columns[i].children().remove();
}

function requestMove() {
  ai.postMessage([game.board, game.columnHeights, game.turn]);
  console.time("Search time");

  //update relevant game features to reflect 'waiting'
  game.waiting = true;
  $progress.addClass('active');
  $undo.removeClass('active');
}

function doMove(player, move) {
  var row = game.columnHeights[move]++;

  game.board[6*move + row] = player > 0 ? 1 : 2;

  //var lineEvals = new Array(37).fill(0);
  var score = scoreBoard(game.board);

  //console.log(lineEvals);
  console.log("BOARD SCORE: "+score);

  addPiece(move, row, player);


  if(game.mode != "CvC") makeHistory(move);
  updateGameStatus(move);
  game.turn *= -1;
  updateCodeField();
}

function addPiece(col, row, p) {
  var $piece = $('<div></div>').addClass('piece '+(p > 0 ? 'light' : 'dark')).appendTo($columns[col]);
  var percentage = (6 - row)*100;

  setTimeout(function(){
    $piece.css('transform','translateY('+percentage+'%)');
  },30);
}


function makeHistory(move){
  game.moveHistory.push(move);

  $undo.addClass('active');
}
function updateCodeField() {
  $boardCode.val(JSON.stringify([
    game.board,
    game.columnHeights,
    game.mode,
    game.turn,
    game.moveHistory
  ]));
}

function undo() {
  if(!$undo.hasClass('active')) return;

  clear(game.moveHistory.pop());
  if(game.mode != "PvP" && game.toMove == "P") //go back an additional move
    clear(game.moveHistory.pop());
  else game.turn *= -1;

  game.ended = false;
  updateMessage('');
  $('.four-in-a-row').removeClass('four-in-a-row');
  updateCodeField();
  if(game.moveHistory.length < 1)
    $undo.removeClass('active');
}


function clear(move){
  var row = --game.columnHeights[move];
  game.board[6*move + row] = 0;

  $columns[move].children().last().remove();
}

function updateMessage(text) {
  $message.text(text)
}

function setupBoard() {
  var hist = game.moveHistory;
  if(hist.length == 0) return;
  var move = hist[hist.length - 1];
  var colHeights = game.columnHeights;
  var p;

  for(var col = 0; col < 7; col++) {
    for(var row = 0; row < colHeights[col]; row++) {
      p = game.board[6*col + row];
      if(p == 2) p = -1;
      addPiece(col, row, p);
    }
  }
  updateGameStatus(move);
  $undo.addClass('active');
}

function updateGameStatus(lastMove){
  var col = lastMove;
  var row = game.columnHeights[col] - 1;
  var b = game.board;

  if(Math.abs(scoreColumn(col, b)) == 1000)
    markColumn(col);
  else if(Math.abs(scoreRow(row, b)) == 1000)
    markRow(row);
  else if(Math.abs(scorePosDiagonal[col - row](b)) == 1000)
    markPosDiagonal(col - row);
  else if(Math.abs(scoreNegDiagonal[col + row](b)) == 1000)
    markNegDiagonal(col + row);
  else if( game.columnHeights.reduce(function(a, b) {return a + b;}) == 42)
    /* draw */;
  else
    return;

  game.ended = true;
  updateMessage("Game over!");

  function markColumn(col){
    markLine(col, 0, 0, 1);
  }
  function markRow(row){
    markLine(0, row, 1, 0);
  }
  function markPosDiagonal(index){
    startCol = index < 0 ? 0 : index;
    startRow = index < 0 ? -index : 0;
    markLine(startCol, startRow, 1, 1);
  }
  function markNegDiagonal(index){
    startCol = index < 5 ? 0 : index - 5;
    startRow = index < 5 ? index : 5;
    markLine(startCol, startRow, 1, -1);
  }

  function markLine(startCol, startRow, colStep, rowStep){
    // return;
    var col, row, coords = [], p, lastP = 3, board = game.board;
    for(var i = 0; i < 7; i++) {
      col = startCol + i*colStep;
      row = startRow + i*rowStep;
      p = board[6*col + row];

      if(p == lastP) {
        coords.push([col, row]);
      } else {
        coords = [[col, row]];
        lastP = p;
      }

      if(coords.length == 4) {
        for(var k = 0; k < 4; k++) {
          col = coords[k][0];
          row = coords[k][1];
          $columns[col].children().eq(row).addClass('four-in-a-row');
        }
        return;
      }

    }
  }
}
