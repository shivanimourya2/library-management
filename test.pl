
:- consult('library_policy.pl').


user('u1', student, 0, 0).
book('b101', 'Intro to Java', 'Java', normal, available).
book_copies('b101', 5).
reservation_queue('b101', []).


:- initialization(main, main).
main :-
    ( can_borrow('u1', 'b101') -> writeln('true') ; writeln('false') ).
