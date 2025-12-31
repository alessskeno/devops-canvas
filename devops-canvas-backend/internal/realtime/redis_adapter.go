package realtime

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

const ChannelName = "devops_canvas_realtime"

type RedisAdapter struct {
	Client *redis.Client
	Ctx    context.Context
}

func NewRedisAdapter(addr string) *RedisAdapter {
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
	})

	return &RedisAdapter{
		Client: rdb,
		Ctx:    context.Background(),
	}
}

func (r *RedisAdapter) Publish(message []byte) error {
	return r.Client.Publish(r.Ctx, ChannelName, message).Err()
}

func (r *RedisAdapter) Subscribe(handler func([]byte)) {
	pubsub := r.Client.Subscribe(r.Ctx, ChannelName)
	defer pubsub.Close()

    ch := pubsub.Channel()

	for msg := range ch {
		handler([]byte(msg.Payload))
	}
    log.Println("Redis subscription ended")
}
