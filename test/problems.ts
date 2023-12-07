import {pipe} from 'fp-ts/function'
import {reduce} from "fp-ts/Array";
import {promises as filesystem} from "fs";

function extractDigitsFrom(aString: string) {
    return aString.replaceAll(/\D/g, '');
}

function extremalCharacters(aString: string) {
    return aString[0] + aString[aString.length - 1];
}

const digitsForWord:Map<string, string> = new Map()
digitsForWord.set('one',   '1')
digitsForWord.set('two',   '2')
digitsForWord.set('three', '3')
digitsForWord.set('four',  '4')
digitsForWord.set('five',  '5')
digitsForWord.set('six',   '6')
digitsForWord.set('seven', '7')
digitsForWord.set('eight', '8')
digitsForWord.set('nine',  '9')

function placesWhereWordsAre(aString: string) : Map<string, number>{
    const firstOccurrenceMap: Map<string, number> = new Map()
    for (const word of digitsForWord.keys()) {
        const firstIndex = aString.indexOf(word)
        if (-1 == firstIndex) {
            continue
        }
        firstOccurrenceMap.set(word, firstIndex)
    }
    return new Map([...firstOccurrenceMap].sort(([k0, v0], [k1, v1]) => v0 - v1));
}

function earliestWordToDigit(aString: string) {
    let result = String(aString)
    const places = placesWhereWordsAre(aString)
    for (let word of places.keys()) {
        const digit = digitsForWord.get(word)
        const prefix = result.substring(0, (places.get(word) || 0))
        const suffix = result.substring((places.get(word) || 0) + 1, result.length)
        result = prefix + digit as string + suffix //will leave any overlapping word intact
        break //only the earliest word this time around, yes this is a hack
    }
    return result
}

function wordsRemain(aString: string){
    let result = false
    for (const word of digitsForWord.keys()) {
        result = result || (-1 != aString.indexOf(word as string))
    }
    return result
}

function fixedPoint(worker: (aString: string) => string, workToDo:(aString: string) => boolean) : (aString: string) => string{
    // this is an iterative implementation of a higher-order function
    // * how would you write a recursive implementation?
    // * how would you have that recursive implementation still result in an iterative _process_ when run?

    return (aString: string) => {
        let currentResult = aString
        while (workToDo(currentResult)) {
            currentResult = worker(currentResult)
        }
        return currentResult
    }
}

function allWordsToDigits(aString: string) {
    return fixedPoint(earliestWordToDigit, wordsRemain)(aString);
}

function extremalDigits(aString: string) {
    return pipe(aString, allWordsToDigits, extractDigitsFrom, extremalCharacters);
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

describe("Advent of Code",()=> {
    describe("1", () => {
        it("finds all digits in a string, in order", () => {
            expect(extractDigitsFrom("ab1c2d3efg4")).toEqual("1234")
        })

        it("finds the first and last characters in a string", () => {
            expect(extremalCharacters("ab1c2d3efg4")).toEqual("a4")
        })

        it("finds the first and last digits in a string", () => {
            expect(extremalDigits("ab1c2d3efg4")).toEqual("14")
        })

        it("finds the integer encoded by a string", () => {
            expect(calibrationValueOf("ab1c2d3efg4")).toEqual(14)
        })

        it("finds the calibration value of a list of strings", () => {
            const exampleInput = [
                "1abc2",
                "pqr3stu8vwx",
                "a1b2c3d4e5f",
                "treb7uchet"]

            expect(calibrationValueIn(exampleInput)).toEqual(142)
        })

        it("find the calibration value of the problem set data", async () => {
            const rawData = await filesystem.readFile('problem_sets/Day1-problem1.txt', 'utf-8')
            const data = rawData.split(/\r?\n/)
            const value = calibrationValueIn(data)
            expect(value).toEqual(57345)
        })

        it("know when there are words left to convert", () => {
            expect(wordsRemain("abctwo123")).toBeTruthy()
            expect(wordsRemain("abc123two")).toBeTruthy()
            expect(wordsRemain("twoabc123")).toBeTruthy()
            expect(wordsRemain("twoabcseven123")).toBeTruthy()
            expect(wordsRemain("abc2t1w2o3")).toBeFalsy()
        })

        it("can find a fixed point", () => {
            const worker = (aString: string) => aString.replace("a", "b")
            const noBs = (aString: string) => {
                const matches = aString.match(/[^a]+g/)
                return (matches ?? []).length == 0
            }

            const withAs = "abaaababa"
            const noAs = "bbbbbbbbb"
            expect(fixedPoint(worker, noBs))

        })

        it("finds first instances of words", () => {
            const theMap: Map<string, number> = placesWhereWordsAre("12onetwo23")
            expect(theMap.get("one")).toEqual(2)
            expect(theMap.get("two")).toEqual(5)
            expect(theMap.get("three")).toBeUndefined()


            const anotherMap: Map<string, number> = placesWhereWordsAre("12onetwo2two3")
            expect(anotherMap.get("one")).toEqual(2)
            expect(anotherMap.get("two")).toEqual(5)
            expect(anotherMap.get("three")).toBeUndefined()

            const yetAnotherMap: Map<string, number> = placesWhereWordsAre("12two2onetwo3")
            let wordCount = 1
            for (const [word, position] of yetAnotherMap) {
                switch (wordCount) {
                    case 1:
                        expect(word).toEqual("two")
                        expect(position).toEqual(2)
                        break
                    case 2:
                        expect(word).toEqual("one")
                        expect(position).toEqual(6)
                        break
                    case 3:
                        fail("no more words expected")
                }
                wordCount = wordCount + 1
            }
        })

        it("processes tricky strings", () => {
                expect(allWordsToDigits('two1nine')).toEqual('2wo19ine')
                expect(allWordsToDigits('xtwone3four')).toEqual('x2w1ne34our')
                expect(allWordsToDigits('xtwone3fourtwo')).toEqual('x2w1ne34our2wo')
                expect(24).toEqual(calibrationValueOf('xtwone3four'))
            }
        )

        it.each([
            ["two1nine", 29],
            ["eightwothree", 83],
            ["abcone2threexyz", 13],
            ["xtwone3four", 24],
            ["4nineeightseven2", 42],
            ["zoneight234", 14],
            ["7pqrstsixteen", 76]])("confirms the examples given", (aString: string, givenValue: number) => {
            expect(calibrationValueOf(aString)).toEqual(givenValue)
        })

        it("sums the example values correctly",()=>{
            const values = [
                "two1nine",
                "eightwothree",
                "abcone2threexyz",
                "xtwone3four",
                "4nineeightseven2",
                "zoneight234",
                "7pqrstsixteen"]
            expect(calibrationValueIn(values)).toEqual(281)
        })

        it.each([
            ["eighthree", 83],
            ["onenine", 19]
        ])("deals with non-obvious cases",(aString: string, givenValue: number)=>{
            expect(calibrationValueOf(aString)).toEqual(givenValue)
        })

    })
})

export{}