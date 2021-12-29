const { parseExpenseInput } = require('../utils')

describe('Parse expense message input', function () {
    it('should successfully parse various inputs', function () {
        const testInputs = [
            ['#Test #sub1 #test et', 'Test', 'sub1', 'test et'],
            ['#Test #sub1 #test', 'Test', 'sub1', 'test'],
            ['#Test #sub2 #test', 'Test', 'sub2', 'test'],
            //['#Test Foo Bar #sub3 test', '#Test Foo Bar', '#sub3', 'test'],
            //['#Test', '#Test', '', ''],
            //['🍰🐀☀️ #sub4 test', '🍰🐀☀️', '#sub4', 'test'],
            ['#Test  #sub5 #test', 'Test', 'sub5', 'test'],
            //['#Test #sub6', '#Test', '#sub6', ''],
            //['#Test #sub7', '#Test', '#sub7', ''],
            ['#Test #sub #a_b sss', 'Test', 'sub', 'a_b sss'],
        ]

        testInputs.forEach(input => {
            //console.log("x y z ", input[0]);
            const result = parseExpenseInput(input[0])
            expect(result).toEqual(input.slice(1))
        })
    }),
        it('should fail to parse invalid inputs', function () {
            const testInputs = [
                '1',
                '1 test',
                'abc #Test test',
                '1+ #Test test',
                '#Test Test test',
                '5*2-3 #Test test',
                '5/2-3 #Test test',
                '0 #Test test',
                '1 #Test #🤓',
                '1 #Test #a-b',
                '#Test #ab ',
            ]

            testInputs.forEach(input => {
                const result = parseExpenseInput(input[0])
                expect(result).toEqual(null)
            })
        })
})