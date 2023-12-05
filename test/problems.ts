import {pipe} from 'fp-ts/function'
import {reduce} from "fp-ts/Array";
import {promises as filesystem} from "fs";

describe("Advent of Code",()=>{
    describe("1",()=>{
        function extractDigitsFrom(aString: string) {
            return aString.replaceAll(/\D/g, '');
        }

        function extremalCharacters(aString: string) {
            return aString[0] + aString[aString.length - 1];
        }

        function extremalDigits(aString: string) {
            return pipe(aString, extractDigitsFrom, extremalCharacters);
        }

        function calibrationValueOf(aString: string) {
            return parseInt(extremalDigits(aString));
        }

        function calibrationValueIn(someStrings: string[]) {
            return reduce(0,
                (accumulator: number, nextElement: string) =>
                    accumulator + calibrationValueOf(nextElement)
            )(someStrings);
        }

        it("finds all digits in a string, in order",()=>{
            expect("1234").toEqual(extractDigitsFrom("ab1c2d3efg4"))
        })

        it("finds the first and last characters in a string", ()=>{
            expect("a4").toEqual(extremalCharacters("ab1c2d3efg4"))
        })

        it("finds the first and last digits in a string",()=>{
            expect("14").toEqual(extremalDigits("ab1c2d3efg4"))
        })

        it("finds the integer encoded by a string",()=>{
            expect(14).toEqual(calibrationValueOf("ab1c2d3efg4"))
        })


        it("finds the calibration value of a list of strings",()=>{
            const exampleInput = [
                "1abc2",
                "pqr3stu8vwx",
                "a1b2c3d4e5f",
                "treb7uchet"]

            expect(142).toEqual(calibrationValueIn(exampleInput))
        })

        it("find the calibration value of the problem set data",async ()=>{
            const rawData = await filesystem.readFile('problem_sets/Day1-problem1.txt','utf-8')
            const data = rawData.split(/\r?\n/)
            const value = calibrationValueIn(data)
            expect(57346).toEqual(value)
        })
    })

})

export{}