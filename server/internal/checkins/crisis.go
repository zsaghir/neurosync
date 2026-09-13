package checkins

import (
	"regexp"
	"strings"
)

var (
	quotedCrisisText = regexp.MustCompile(`["“][^"”]*["”]`)
	nonCrisisWord    = regexp.MustCompile(`[^a-z0-9]+`)
)

var crisisPhrases = []string{
	"i want to kill myself",
	"i am going to kill myself",
	"i will kill myself",
	"i plan to kill myself",
	"i intend to kill myself",
	"i am about to kill myself",
	"i have a plan to kill myself",
	"i am planning to kill myself",
	"i want to end my life",
	"i am going to end my life",
	"i will end my life",
	"i plan to end my life",
	"i intend to end my life",
	"i am about to end my life",
	"i have a plan to end my life",
	"i am planning to end my life",
	"i am going to commit suicide",
	"i will commit suicide",
	"i plan to commit suicide",
	"i intend to commit suicide",
	"i am about to commit suicide",
	"i am thinking about killing myself",
	"i have been thinking about killing myself",
	"i am thinking about suicide",
	"i have been thinking about suicide",
	"i feel suicidal",
	"i am suicidal",
	"i am going to hurt myself",
	"i will hurt myself",
	"i plan to hurt myself",
	"i intend to hurt myself",
	"i am about to hurt myself",
	"i am going to harm myself",
	"i will harm myself",
	"i plan to harm myself",
	"i intend to harm myself",
	"i am about to harm myself",
	"i am going to self harm",
	"i will self harm",
	"i plan to self harm",
	"i intend to self harm",
	"i am about to self harm",
	"i am in immediate danger",
	"i am in danger right now",
	"my life is in immediate danger",
	"someone is trying to kill me",
	"someone is going to kill me",
	"someone is trying to hurt me",
	"someone is going to hurt me",
	"someone is trying to harm me",
}

// requiresCrisisSupport identifies only direct, high-confidence crisis language.
// It is deliberately incomplete and must not be treated as a medical assessment.
func requiresCrisisSupport(value string) bool {
	normalized := normalizeCrisisText(value)
	for _, phrase := range crisisPhrases {
		if strings.Contains(normalized, phrase) {
			return true
		}
	}
	return false
}

func normalizeCrisisText(value string) string {
	value = quotedCrisisText.ReplaceAllString(value, " ")
	value = strings.ToLower(value)
	value = strings.NewReplacer(
		"i'm", "i am",
		"i’m", "i am",
		"i've", "i have",
		"i’ve", "i have",
		"i'll", "i will",
		"i’ll", "i will",
		"don't", "do not",
		"don’t", "do not",
	).Replace(value)
	value = nonCrisisWord.ReplaceAllString(value, " ")
	return strings.Join(strings.Fields(value), " ")
}
