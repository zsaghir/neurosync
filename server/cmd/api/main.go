package main
import (
	"fmt"
	"log"
	"net/http"
	)
func main() {
	http.HandleFunc("/health",handleHealth)
	log.Println("Starting server om port 8080")
	err := http.ListenAndServe(":8080",nil)
	if err !=nil {
		log.Fatal(err)
	}
}
func handleHealth(w http.ResponseWriter ,r *http.Request) {
	fmt.Fprintf(w,"healthy")
}
