:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/json)).
:- use_module(library(lists)).
:- use_module(library(apply)).

:- http_handler(root(.),          serve_index,  []).
:- http_handler(root('css/style.css'), serve_css, []).
:- http_handler(root('js/game.js'),   serve_js,  []).
:- http_handler(root('api/move'),  api_move,   [method(post)]).
:- http_handler(root('api/solve'), api_solve,  [method(post)]).

server(Port) :-
    http_server(http_dispatch, [port(Port)]).

serve_index(Request) :-
    http_reply_file('index.html', [mime_type(text/html)], Request).
serve_css(Request) :-
    http_reply_file('css/style.css', [mime_type(text/css)], Request).
serve_js(Request) :-
    http_reply_file('js/game.js', [mime_type(text/javascript)], Request).

api_move(Request) :-
    catch(
        ( http_read_json_dict(Request, Data),
          State = Data.state,
          From = Data.from,
          To = Data.to,
          ( integer(From), integer(To),
            valid_move(State, From, To, NewState)
          -> reply_json_dict(_{valid:true, newState:NewState})
          ;  reply_json_dict(_{valid:false})
          )
        ),
        _,
        reply_json_dict(_{valid:false})
    ).

api_solve(Request) :-
    catch(
        ( http_read_json_dict(Request, Data),
          Disks = Data.disks,
          Pegs = Data.pegs,
          integer(Disks), Disks >= 1, Disks =< 10,
          ( Pegs =:= 3
          -> numlist(1, Disks, Ascending),
             reverse(Ascending, StartPeg),
             hanoi(Disks, 0, 2, 1, Moves),
             reply_json_dict(_{moves:Moves})
          ;  reply_json_dict(_{error:"This version supports exactly 3 pegs."}, [status(400)])
          )
        ),
        _,
        reply_json_dict(_{error:"Invalid solve request."}, [status(400)])
    ).

/*
   State is a list of pegs; each peg is bottom-to-top.
   Peg indexes are zero-based to match JavaScript arrays.
*/
valid_move(State, From, To, NewState) :-
    integer(From), integer(To),
    From =\= To,
    nth0(From, State, SourcePeg),
    nth0(To, State, DestinationPeg),
    last(SourcePeg, TopDisk),
    ( DestinationPeg = []
    ; last(DestinationPeg, DestinationTop),
      TopDisk < DestinationTop
    ),
    append(SourceRest, [TopDisk], SourcePeg),
    append(DestinationPeg, [TopDisk], DestinationNew),
    replace_nth0(From, State, SourceRest, StateWithoutSource),
    replace_nth0(To, StateWithoutSource, DestinationNew, NewState).

replace_nth0(Index, List, Value, NewList) :-
    same_length(List, NewList),
    nth0(Index, List, _, Rest),
    nth0(Index, NewList, Value, Rest).

/* Standard optimal three-peg recursive Tower of Hanoi solver.
   Move terms are JSON-friendly dicts with zero-based peg indexes.
*/
hanoi(0, _, _, _, []) :- !.
hanoi(N, From, To, Aux, Moves) :-
    N > 0,
    N1 is N - 1,
    hanoi(N1, From, Aux, To, FirstMoves),
    hanoi(N1, Aux, To, From, LastMoves),
    append(FirstMoves, [_{from:From, to:To}|LastMoves], Moves).

:- initialization(main, main).

main :-
    server(8080),
    format('~nTower of Hanoi server running at http://localhost:8080/~n', []),
    thread_get_message(_).
