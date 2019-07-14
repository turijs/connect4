var maxDepth = 42;
var searchTime = 1;//seconds
var tableSize = 4194304;
var movesChecked = 0, tableHits = 0, keyCollisions = 0;
var pruneCount = 0;

var EvalCache7 = createLineEvalCache(7),
    EvalCache6 = createLineEvalCache(6),
    EvalCache5 = createLineEvalCache(5),
    EvalCache4 = createLineEvalCache(4);


var scorePosDiagonal = {};
  scorePosDiagonal[0] = function(b) {return EvalCache6[b[0]*243 +b[7]*81 +b[14]*27 +b[21]*9 +b[28]*3 +b[35] ]};
  scorePosDiagonal[1] = function(b) {return EvalCache6[b[6]*243 +b[13]*81 +b[20]*27 +b[27]*9 +b[34]*3 +b[41] ]};
  scorePosDiagonal[2] = function(b) {return EvalCache5[b[12]*81 +b[19]*27 +b[26]*9 +b[33]*3 +b[40] ]};
  scorePosDiagonal[-1] = function(b) {return EvalCache5[b[1]*81 +b[8]*27 +b[15]*9 +b[22]*3 +b[29] ]};
  scorePosDiagonal[3] = function(b) {return EvalCache4[b[18]*27 +b[25]*9 +b[32]*3 +b[39] ]};
  scorePosDiagonal[-2] = function(b) {return EvalCache4[b[2]*27 +b[9]*9 +b[16]*3 +b[23] ]};
  scorePosDiagonal[4] = scorePosDiagonal[5] = scorePosDiagonal[6] = scorePosDiagonal[-3] = scorePosDiagonal[-4] = scorePosDiagonal[-5] = function() {return 0};

var scoreNegDiagonal = [];
  scoreNegDiagonal[3] = function(b) {return EvalCache4[b[3]*27 +b[8]*9 +b[13]*3 +b[18] ]};
  scoreNegDiagonal[4] = function(b) {return EvalCache5[b[4]*81 +b[9]*27 +b[14]*9 +b[19]*3 +b[24] ]};
  scoreNegDiagonal[5] = function(b) {return EvalCache6[b[5]*243 +b[10]*81 +b[15]*27 +b[20]*9 +b[25]*3 +b[30] ]};
  scoreNegDiagonal[6] = function(b) {return EvalCache6[b[11]*243 +b[16]*81 +b[21]*27 +b[26]*9 +b[31]*3 +b[36] ]};
  scoreNegDiagonal[7] = function(b) {return EvalCache5[b[17]*81 +b[22]*27 +b[27]*9 +b[32]*3 +b[37] ]};
  scoreNegDiagonal[8] = function(b) {return EvalCache4[b[23]*27 +b[28]*9 +b[33]*3 +b[38] ]};
  scoreNegDiagonal[0] = scoreNegDiagonal[1] = scoreNegDiagonal[2] = scoreNegDiagonal[9] = scoreNegDiagonal[10] = scoreNegDiagonal[11] = function() {return 0};

function scoreRow(n,b) {
  return EvalCache7[b[0+n]*729 +b[6+n]*243 +b[12+n]*81 +b[18+n]*27 +b[24+n]*9 +b[30+n]*3 +b[36+n] ];
}

function scoreColumn(n,b) {
  return EvalCache6[b[6*n]*243 +b[6*n + 1]*81 +b[6*n + 2]*27 +b[6*n + 3]*9 +b[6*n + 4]*3 +b[6*n + 5] ];
}

// columns        rows               pos diagonals                        neg diagonals
// 0 1 2 3 4 5 6 | 0 1 2  3  4  5  | -5 -4 -3 -2 -1  0  1  2  3  4  5  6 |  0  1  2  3  4  5  6  7  8  9 10 11
// 0 1 2 3 4 5 6   7 8 9 10 11 12    13 14 15 16 17 18 19 20 21 22 23 24   25 26 27 28 29 30 31 32 33 34 35 36

function scoreBoard(b, lineEvals) {
  if(typeof lineEvals == 'undefined')
    var lineEvals = new Array(37).fill(0);

  var score = 0, c, r, p, n;

  for(var i = 0; i < 6; i++) {
    c = scoreColumn(i,b);  lineEvals[i] = c;
    r = scoreRow(i,b);  lineEvals[i + 7] = r;
    p = scorePosDiagonal[i-2](b);  lineEvals[i + 16] = p;
    n = scoreNegDiagonal[i+3](b);  lineEvals[i + 28] = n;
    score +=  c + r + p + n ;
  }
  c = scoreColumn(6,b); lineEvals[6] = c;
  score += c;

  return score;
}

var zobristNums = createZobristNums();
var zobristNums2 = createZobristNums();

var tTable = Object.create(null);//new Array(tableSize).fill(0);

onmessage = function(e) {
  var board = e.data[0], columnHeights = e.data[1], p = e.data[2];

  var move = findBestMove(board, columnHeights, p);

  //console.log(tTable);

  postMessage([move]);

};


console.log(zobristNums);


//console.log(EvalCache7);


//console.log(evalLine(parseInt("000001",2),parseInt("111000",2),6));

function findBestMove(board, columnHeights, p){
  movesChecked = 0;
  pruneCount = 0;
  tableHits = 0;
  keyCollisions = 0;
  var endTime = Date.now() + searchTime*1000;

  var remainingMoves = 42 - columnHeights.reduce(function(a, b) {
    return a + b;
  });
  var lineEvals = new Array(37).fill(0);
  var boardScore = scoreBoard(board, lineEvals);

  var zobristKey = initZobristKey(board, zobristNums);
  var zobristLock = initZobristKey(board, zobristNums2);

  function initZobristKey(board, nums){
    var key = 0, pl;
    for(var i = 0; i < 42; i++) {
      if(pl = board[i])
        key ^= nums[pl][i];
    }
    return key;
  }

  console.log("Remaining moves: "+remainingMoves);

  var a, b, max, bestMove, actualDepth = 0, maxDepthReached = 0;
  var moveValues = new Array(7).fill(-Infinity), rankedMoves = [0,1,2,3,4,5,6];
  try {
    for(var curDepth = 1; curDepth <= 100 /*maxDepth*/; curDepth++) {
      a = -Infinity; b = Infinity;
      max = -Infinity;

      actualDepth = 0;


      for(var i = 0; i < 7; i++) {
        var move = rankedMoves[i]
        var row = columnHeights[move];
        if(row > 5) continue;

        //Make move
        var pNum = p > 0 ? 1 : 2;
        board[6*move + row] = pNum;

        var nC = scoreColumn(move, board);
        var nR = scoreRow(row, board);
        var nP = scorePosDiagonal[move - row](board);
        var nN = scoreNegDiagonal[move + row](board);

        if (p*nR == 1000 || p*nC == 1000 || p*nP == 1000 || p*nN == 1000) {
          console.log("********************\nWin...\n********************");
          return bestMove = move;
        } else {
          //save old values
          var oC = lineEvals[move];
          var oR = lineEvals[row + 7];
          var oP = lineEvals[move - row + 18];
          var oN = lineEvals[move + row + 25];

          //make
          columnHeights[move]++;
          lineEvals[move] = nC;
          lineEvals[row + 7] = nR;
          lineEvals[move - row + 18] = nP;
          lineEvals[move + row + 25] = nN;

          var newBoardScore = boardScore + nC - oC + nR - oR + nP - oP + nN - oN;
          var newZobristKey = zobristKey ^ zobristNums[pNum][6*move + row];
          var newZobristLock = zobristLock ^ zobristNums2[pNum][6*move + row];

          var m = -negamax(board, columnHeights, lineEvals, newBoardScore, newZobristKey, newZobristLock, curDepth-1, remainingMoves-1, -p, -b, -a);
          //console.log(m);
          moveValues[move] = m;
          a = Math.max(a, m);

          //unmake move
          board[6*move + row] = 0;
          columnHeights[move]--;
          lineEvals[move] = oC;
          lineEvals[row + 7] = oR;
          lineEvals[move - row + 18] = oP;
          lineEvals[move + row + 25] = oN;

          //prune?
          // if(a >= b){
          //   pruneCount++;
          //   break;
          // }
        }
      }//moves loop

      rankedMoves.sort(function(a,b){
        return [moveValues[b] - moveValues[a]];
      });

      maxDepthReached = Math.max(actualDepth, maxDepthReached);
      if(actualDepth < curDepth){
        console.log("Didn't reach allowed depth");
        break;
      }
      // console.log("For depth: "+curDepth+" -------------");
      // console.log("  Move values: ", moveValues);
      // console.log("  Ranked moves: ",rankedMoves);

    }//depth loop
  } catch(exception) {
    if(exception == "Out of Time") {
      // rankedMoves.sort(function(a,b){
      //   return [moveValues[b] - moveValues[a]];
      // });
    } else {
      throw exception;
    }
  }
  bestMove = rankedMoves[0];
  // console.log("Move values: ", moveValues);
  // console.log("Ranked moves: ",rankedMoves);
  console.log("Max depth reached: "+maxDepthReached);
  console.log("Moves checked: "+movesChecked);
  console.log("Branches pruned: "+pruneCount);
  console.log("table hits: "+tableHits);
  console.log("Collisions: "+keyCollisions);
  console.log("Max node: ",moveValues[bestMove]);
  return bestMove;

  /* - - - - - - - - - - - - - - */

  function negamax(board, columnHeights, lineEvals, boardScore, zobristKey, zobristLock, remainingDepth, remainingMoves, p, a, b) {
    movesChecked++;
    var depth = curDepth - remainingDepth;
    actualDepth = Math.max(actualDepth, depth);
    if(Date.now() > endTime) throw "Out of Time";

    if (remainingMoves == 0) return 0;
    if(remainingDepth == 0) return p*boardScore;

    var alphaOrig = a, pv = 0, replace = true;
    //transposition lookup
    /*var ttEntry = tTable[zobristKey % tableSize] || 0;
    if (ttEntry && ttEntry.zobristKey == zobristKey && ttEntry.p == p && ttEntry.zobristLock == zobristLock){
      pv = ttEntry.bestMove;
      if(ttEntry.remainingDepth >= remainingDepth){
        tableHits++;
        replace = false;

        //actualDepth = Math.max(actualDepth, curDepth);
        //actualDepth = Math.max(actualDepth, depth + ttEntry.remainingDepth);

        //if(board.toString() != ttEntry.b) keyCollisions++;

        if (ttEntry.flag = 0) //exact
          return ttEntry.val;
        else if (ttEntry.flag = -1) //lowerbound
          a = Math.max(a, ttEntry.val);
        else if (ttEntry.flag = 1) //upperbound
          b = Math.min(b, ttEntry.val);

        if (a >= b)
          return ttEntry.val;
      }
    }*/


    var max = -Infinity;
    for(var i = 0; i < 7; i++) {
      var move = (i + pv) % 7;
      var row = columnHeights[move];
      if(row > 5) continue;

      //Make move
      var pNum = p > 0 ? 1 : 2;
      board[6*move + row] = pNum;

      var nC = scoreColumn(move, board);
      var nR = scoreRow(row, board);
      var nP = scorePosDiagonal[move - row](board);
      var nN = scoreNegDiagonal[move + row](board);

      if (p*nR == 1000 || p*nC == 1000 || p*nP == 1000 || p*nN == 1000) {
        board[6*move + row] = 0;//unmake move
        movesChecked++;
        return 1000 + remainingDepth;
      }
      else {
        //save old values
        var oC = lineEvals[move];
        var oR = lineEvals[row + 7];
        var oP = lineEvals[move - row + 18];
        var oN = lineEvals[move + row + 25];

        //make
        columnHeights[move]++;
        lineEvals[move] = nC;
        lineEvals[row + 7] = nR;
        lineEvals[move - row + 18] = nP;
        lineEvals[move + row + 25] = nN;

        var newBoardScore = boardScore + nC - oC + nR - oR + nP - oP + nN - oN;
        var newZobristKey = zobristKey ^ zobristNums[pNum][6*move + row];
        var newZobristLock = zobristLock ^ zobristNums2[pNum][6*move + row];

        var m = -negamax(board, columnHeights, lineEvals, newBoardScore, newZobristKey, newZobristLock, remainingDepth-1, remainingMoves-1, -p, -b, -a);
        if(m > max){
          max = m;
          bestMove = move;
        }
        // max = Math.max(m, max);
        a = Math.max(m, a);

        //unmake move
        board[6*move + row] = 0;
        columnHeights[move]--;
        lineEvals[move] = oC;
        lineEvals[row + 7] = oR;
        lineEvals[move - row + 18] = oP;
        lineEvals[move + row + 25] = oN;

        //prune?
        if(a >= b){
          pruneCount++;
          break;
        }


      }

    }
  /*if(remainingDepth > 2 && replace == true){
      ttEntry = Object.create(null);
      ttEntry.val = max;
      if (max <= alphaOrig)
        ttEntry.flag = 1; //uperbound
      else if (max >= b)
        ttEntry.flag = -1; //lowerbound
      else
        ttEntry.flag = 0; //exact

      ttEntry.remainingDepth = remainingDepth;
      ttEntry.zobristKey = zobristKey;
      ttEntry.zobristLock = zobristLock;
      ttEntry.p = p;
      ttEntry.bestMove = bestMove;
      //ttEntry.b = board.toString();
      tTable[zobristKey % tableSize] = ttEntry;
    }*/

    return max;
  }
}



function evalLine(p1, p2, length) {
  if ( fourInRow(p1) ) return 1000;
  else if ( fourInRow(p2) ) return -1000;
  var score = 0, mask = (1 << length) - 1;

  var openSlots = ~(p1 | p2) & mask;
  if( !openSlots ) return 0;

  score += scorePlayer(p1, openSlots);
  score -= scorePlayer(p2, openSlots);

  return score;////////////////////////

  function scorePlayer(p, openSlots){
    var score = 0;

    var b1, poss = openSlots;//initialize possibilities to open slots
    while (b1 = poss & -poss) {
      poss ^= b1;
      if( fourInRow(p | b1)) {
        score += 15;
        openSlots ^= b1;
      }
    }

    var b2, b12; poss = openSlots;
    while (function(){
      b1 = poss & -poss; poss ^= b1;
      b2 = poss & -poss;
      b12 = b1 | b2;
      return b2;
    }()) {
      if( fourInRow(p | b12)) {
        score += 4;
        openSlots &= ~b12;
      }
    }

    var b3, b123, _poss; poss = openSlots;
    while (function(){
      b1 = poss & -poss; poss ^= b1;
      b2 = poss & -poss; _poss = poss ^ b2;
      b3 = _poss & -_poss;
      b123 = b1 | b2 | b3;
      return b3;
    }()) {
      //console.log(b123.toString(2));
      if( fourInRow(p | b123)) {
        score += 1;
      }
    }
    return score;
  }// scorePlayer //

  function fourInRow (l) {
    return l & l << 1 & l << 2 & l<< 3;
  }
}



function createLineEvalCache(lineLength) {
  var players = [0,0], cache = [];

  (function iterate(index, p0, p1, d) {
    if (d == lineLength) {
      cache[parseInt(index,3)] = evalLine(p0, p1, lineLength);
      return;
    }
    for(var i = 0; i < 3; i++) {
      var b = [0,0]; if(i) b[i-1] = 1 << (lineLength-d-1);
      iterate(index+i, p0 | b[0], p1 | b[1], d+1);
    }
  }('',0,0,0));

  return cache;
}

function createZobristNums() {
  var obj = {};
  obj[1] = genArr42();
  obj[2]  = genArr42();

  return obj;

  function genArr42() {
    var arr42 = [];
    for(var i = 1; i < 42; i++)
      arr42[i] = Math.floor(Math.random()*4294967296);
    return arr42;
  }
}


/*function buildBitRow(dl, bitMove) {
  // console.log(dl);
  // console.log(bitMove);
  return !!(dl[0] & bitMove) * 1  +
         !!(dl[1] & bitMove) * 2 +
        !!(dl[2] & bitMove) * 4 +
        !!(dl[3] & bitMove) * 8 +
        !!(dl[4] & bitMove) * 16 +
        !!(dl[5] & bitMove) * 32 +
        !!(dl[6] & bitMove) * 64;
}

function buildBitPosDiag(dl,bitMove,col) {
  var row = bitIndexMap(bitMove);
  dLength = posDiagLengths[col - row];

}

function buildBitNegDiag() {

}*/


/*[p0, p1].map(function(cur){
  str = cur.toString(2);
  while (str.length < 7)
    str = "0" + str;
  return str;
})*/

//[0,0,0,0,0,0,  0,0,0,0,0,0,  0,0,0,0,0,0,  0,0,0,0,0,0,  0,0,0,0,0,0,  0,0,0,0,0,0, 0];
