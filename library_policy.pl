% ==============================================================================
% Library Resource & Fine Optimizer Tool - Logic Policy Engine
% ==============================================================================

% ------------------------------------------------------------------------------
% 1. Configuration & Extensibility Facts
% ------------------------------------------------------------------------------
% These facts act as the configurable policies of the library.
% They avoid hardcoding values in the logic rules.

% max_borrow_limit(UserType, Limit)
max_borrow_limit(student, 3).
max_borrow_limit(professor, 10).
max_borrow_limit(senior, 5).

% max_unpaid_fines(UserType, ThresholdAmount)
max_unpaid_fines(student, 20.0).
max_unpaid_fines(professor, 50.0).
max_unpaid_fines(senior, 30.0).

% grace_period(UserType, Days)
grace_period(student, 0).
grace_period(professor, 0).
grace_period(senior, 0).

% fine_rate(UserType, DailyRate)
fine_rate(student, 5.0).
fine_rate(professor, 2.0).
fine_rate(senior, 5.0).

% fine_discount(UserType, Year, DiscountPercentage) - 0.0 to 1.0
fine_discount(_, 'SE', 0.5) :- !. % Seniors (SE) get 50% off
fine_discount(_, 'TE', 0.5) :- !. % Seniors (TE) get 50% off
fine_discount(_, 'BE', 0.5) :- !. % Seniors (BE) get 50% off
fine_discount(senior, _, 0.5) :- !. % Default senior type gets 50% off
fine_discount(_, _, 0.0).

% Subject Ontology / Knowledge Graph for Recommendations
related_subject('Java', 'Data Structures').
related_subject('Java', 'OOP').
related_subject('Data Structures', 'Algorithms').
related_subject('Algorithms', 'Mathematics').

% Bidirectional relationship helper
is_related(S1, S2) :- related_subject(S1, S2).
is_related(S1, S2) :- related_subject(S2, S1).

% ------------------------------------------------------------------------------
% 2. Dynamic Data Modeling (Users, Books, Reservations, Violations)
% ------------------------------------------------------------------------------
% These facts will be populated dynamically from the SQL database via Node.js

:- dynamic user/5. % UserId, UserType, BorrowedCount, UnpaidFines, Year
:- dynamic book/5.
:- dynamic book_copies/2.
:- dynamic reservation_queue/2.
:- dynamic blacklisted/1.
:- dynamic has_book/2. % Tracks if UserId already has BookId
:- dynamic exceeded_max_overdue_books/1.

% ------------------------------------------------------------------------------
% 3. Eligibility Constraints
% ------------------------------------------------------------------------------

% is_eligible(UserId) evaluates to true if the user is in good standing.
is_eligible(UserId) :-
    \+ blacklisted(UserId),
    \+ exceeded_max_overdue_books(UserId).

% ------------------------------------------------------------------------------
% 4. Reservation Handling
% ------------------------------------------------------------------------------

% User can borrow a book if there is no queue or the queue is empty
has_reservation_priority(UserId, BookId) :-
    \+ reservation_queue(BookId, _). % No queue exists at all
has_reservation_priority(_, BookId) :-
    reservation_queue(BookId, []), !. % Queue is empty

% If user is in the queue, check if their index is < AvailableCopies
has_reservation_priority(UserId, BookId) :-
    reservation_queue(BookId, Queue),
    nth0(Index, Queue, UserId),
    book_copies(BookId, AvailableCopies),
    Index < AvailableCopies, !.

% If user is NOT in the queue, they can borrow only if there are enough copies 
% for everyone in the queue PLUS them
has_reservation_priority(UserId, BookId) :-
    reservation_queue(BookId, Queue),
    \+ member(UserId, Queue),
    length(Queue, QueueLen),
    book_copies(BookId, AvailableCopies),
    AvailableCopies > QueueLen.

% ------------------------------------------------------------------------------
% 5. Borrowing Rules
% ------------------------------------------------------------------------------

% can_borrow(UserId, BookId)
can_borrow(UserId, BookId) :-
    % 1. Fetch user and book facts
    user(UserId, UserType, BorrowedCount, UnpaidFines, Year),
    book(BookId, _, _, BookType, Status),
    
    % 2. Check general eligibility (not blacklisted, etc.)
    is_eligible(UserId),
    
    % 3. Check borrowing limits
    max_borrow_limit(UserType, MaxLimit),
    BorrowedCount < MaxLimit,
    
    % 4. Check unpaid fines threshold
    max_unpaid_fines(UserType, MaxFines),
    UnpaidFines =< MaxFines,
    
    % 5. User must NOT already have this book
    \+ has_book(UserId, BookId),
    
    % 6. Book must not be a reference book
    BookType \= reference,
    
    % 7. Book must be currently available
    Status = available,
    
    % 8. Check reservation priority
    has_reservation_priority(UserId, BookId).

% ------------------------------------------------------------------------------
% 6. Grace Period & Fine Calculation
% ------------------------------------------------------------------------------

% calculate_fine(DaysOverdue, UserType, TotalFine)

% Base case: Within grace period -> 0 fine
calculate_fine(DaysOverdue, UserType, 0.0) :-
    grace_period(UserType, Grace),
    DaysOverdue =< Grace, !.

% Recursive/Calculation case: Exceeded grace period -> Calculate fine
calculate_fine(DaysOverdue, UserType, Year, TotalFine) :-
    grace_period(UserType, Grace),
    DaysOverdue > Grace,
    fine_rate(UserType, Rate),
    fine_discount(UserType, Year, Discount),
    
    ChargeableDays is DaysOverdue - Grace,
    BaseFine is ChargeableDays * Rate,
    TotalFine is BaseFine * (1.0 - Discount).

% Legacy support or default
calculate_fine(DaysOverdue, UserType, TotalFine) :-
    calculate_fine(DaysOverdue, UserType, 'N/A', TotalFine).

% ------------------------------------------------------------------------------
% 7. Smart Recommendation System
% ------------------------------------------------------------------------------

% recommend(BookId, RecommendedBooksList)
% Gathers all books that share a related subject to the provided BookId.
recommend(BookId, RecommendedBooks) :-
    book(BookId, _, Subject, _, _),
    findall(
        RecBookId,
        (
            book(RecBookId, _, RecSubject, normal, _),
            RecBookId \= BookId,      % Don't recommend the same book
            is_related(Subject, RecSubject)
        ),
        RecommendedBooks
    ).
