const { exec } = require('child_process');
const fs = require('fs');

const facts = `
user('u1', student, 0, 0).
book('b101', 'Intro to Java', 'Java', normal, available).
book_copies('b101', 5).
reservation_queue('b101', []).
`;

const tempFile = 'test.pl';
const content = `
:- consult('library_policy.pl').

${facts}

:- initialization(main, main).
main :-
    ( can_borrow('u1', 'b101') -> writeln('true') ; writeln('false') ).
`;
fs.writeFileSync(tempFile, content);

exec(`swipl -q -s "${tempFile}"`, (error, stdout, stderr) => {
    console.log("error:", error);
    console.log("stdout:", stdout.trim());
    console.log("stderr:", stderr);
});
