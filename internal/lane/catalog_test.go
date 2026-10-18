package lane

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

// fakeNet is a scripted HTTPClient: every call runs onReq then handler.
type fakeNet struct {
	t       *testing.T
	onReq   func(r *http.Request)
	handler func(r *http.Request) (*http.Response, error)
}

func (f *fakeNet) Do(r *http.Request) (*http.Response, error) {
	if f.onReq != nil {
		f.onReq(r)
	}
	return f.handler(r)
}

func fixed(code int, body string) func(*http.Request) (*http.Response, error) {
	return func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: code, Body: io.NopCloser(strings.NewReader(body))}, nil
	}
}

const bodyX = `{"data":[
 {"id":"qwen/qwen3.8-max:free","owned_by":"Alibaba","context_length":1000000,
  "capabilities":{"vision":true,"tools":true,"reasoning":true},"access_tier":"free"},
 {"id":"cohere/command-a-reasoning","owned_by":"qwen","context_length":2000000,
  "capabilities":{"vision":true,"tools":true},"access_tier":"free"}]}`

const body7 = `{"data":[{"id":"glm-5.3","owned_by":"api","context_length":131072,"access_tier":"free"}]}`

func TestProbeMergesAndSendsAuthOnlyWhenKeyed(t *testing.T) {
	n := &fakeNet{t: t}
	seen := map[string]string{}
	n.onReq = func(r *http.Request) { seen[r.URL.Host] = r.Header.Get("Authorization") }
	n.handler = func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "x" {
			return fixed(200, bodyX)(r)
		}
		return fixed(200, body7)(r)
	}
	models := Probe(n, []*Lane{
		{Name: "xkiro", URL: "http://x/v1", Key: "sk-xt-test"},
		{Name: "llm7", URL: "http://7/v1"},
	})
	if len(models) != 3 {
		t.Fatalf("want 3 merged models, got %d", len(models))
	}
	if got := models[0].ID; got != "qwen/qwen3.8-max:free" {
		t.Fatalf("first model id = %q", got)
	}
	if models[0].Lane != "xkiro" || models[0].Owner != "Alibaba" || models[0].Ctx != 1000000 {
		t.Fatalf("normalization off: %+v", models[0])
	}
	if !models[0].Vision || !models[0].Tools || !models[0].Reasoning {
		t.Fatalf("capabilities not carried: %+v", models[0])
	}
	if models[0].Tier != "free" {
		t.Fatalf("tier = %q", models[0].Tier)
	}
	if seen["x"] != "Bearer sk-xt-test" {
		t.Fatalf("keyed lane auth = %q", seen["x"])
	}
	if seen["7"] != "" {
		t.Fatalf("keyless lane must send no Authorization, got %q", seen["7"])
	}
}

func TestProbeSkipsDeadLanes(t *testing.T) {
	n := &fakeNet{t: t, handler: func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "dead" {
			return nil, errors.New("conn refused")
		}
		return fixed(200, body7)(r)
	}}
	models := Probe(n, []*Lane{
		{Name: "dead", URL: "http://dead/v1", Key: "k"},
		{Name: "llm7", URL: "http://7/v1"},
	})
	if len(models) != 1 || models[0].Lane != "llm7" {
		t.Fatalf("dead lane must be skipped, got %+v", models)
	}
}

func TestProbeSkipsNon200AndBadJSON(t *testing.T) {
	n := &fakeNet{t: t, handler: func(r *http.Request) (*http.Response, error) {
		switch r.URL.Host {
		case "x":
			return fixed(500, "{}")(r)
		case "j":
			return fixed(200, "{not json")(r)
		}
		return fixed(200, body7)(r)
	}}
	models := Probe(n, []*Lane{
		{Name: "xkiro", URL: "http://x/v1", Key: "k"},
		{Name: "bad", URL: "http://j/v1"},
		{Name: "llm7", URL: "http://7/v1"},
	})
	if len(models) != 1 || models[0].Lane != "llm7" {
		t.Fatalf("500/bad-json lanes must be skipped, got %+v", models)
	}
}
